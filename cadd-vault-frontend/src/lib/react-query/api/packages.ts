import { supabase } from '../../../supabase';
import { Package, PackageWithNormalizedData } from '../../../types';

export interface PackageFilters {
  searchTerm?: string;
  selectedTags?: string[];
  minStars?: number | null;
  hasGithub?: boolean;
  hasWebserver?: boolean;
  hasPublication?: boolean;
  minCitations?: number | null;
  minRating?: number | null;
  folder?: string | null;
  category?: string | null;
  selectedLicenses?: string[];
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeUserRatings?: boolean;
  currentUserId?: string | null;
}

export interface PackageQueryResult {
  packages: PackageWithNormalizedData[];
  totalCount: number;
  userRatings?: Map<string, { rating: number; rating_id: string }>;
}

// Columns that may be passed to .order(). The UI restricts sortBy to these
// values; this allowlist guards against a caller (store action, console)
// passing an arbitrary column name through to PostgREST.
const ALLOWED_SORT_COLUMNS = new Set([
  'package_name',
  'average_rating',
  'ratings_count',
  'github_stars',
  'citations',
  'last_commit',
]);

// Helper function to add timeout to async operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

export const packageApi = {
  async getPackages(filters: PackageFilters = {}): Promise<PackageQueryResult> {
    // Wrap the entire function with timeout
    return withTimeout((async (): Promise<PackageQueryResult> => {
    const {
      searchTerm,
      selectedTags = [],
      minStars,
      hasGithub,
      hasWebserver,
      hasPublication,
      minCitations,
      minRating,
      folder,
      category,
      selectedLicenses = [],
      sortBy,
      sortDirection = 'desc',
      page = 1,
      pageSize = 50,
      includeUserRatings = false,
      currentUserId
    } = filters;

    // Build the base query with all relationships
    let query = supabase
      .from('packages')
      .select(`
        *,
        package_tags!left(
          tag_id,
          tags!inner(id, name)
        ),
        package_folder_categories!left(
          folder_category_id,
          folder_categories!inner(
            id,
            folder_id,
            category_id,
            folders!inner(id, name),
            categories!inner(id, name)
          )
        )
      `, { count: 'exact' });

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      query = query.or(`package_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // Apply tag filters (SERVER-SIDE)
    if (selectedTags.length > 0) {
      // Get tag IDs first
      const { data: tagData } = await supabase
        .from('tags')
        .select('id, name')
        .in('name', selectedTags);

      if (tagData && tagData.length > 0) {
        const tagIds = tagData.map(t => t.id);

        // Find packages that have ALL selected tags using proper intersection logic
        // Use database function or raw SQL for proper tag intersection
        const { data: packageIdsWithAllTags, error: tagError } = await supabase.rpc(
          'get_packages_with_all_tags',
          { tag_ids: tagIds }
        );

        if (tagError) {
          console.warn('RPC function not available, falling back to client-side filtering:', tagError);
          
          // Fallback: Get all package-tag associations for selected tags
          const { data: packageTagData } = await supabase
            .from('package_tags')
            .select('package_id, tag_id')
            .in('tag_id', tagIds);

          if (packageTagData && packageTagData.length > 0) {
            // Client-side intersection logic
            const packageTagCounts = packageTagData.reduce((acc, pt) => {
              acc[pt.package_id] = (acc[pt.package_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            // Only include packages that have ALL selected tags
            const packageIdsWithAllTagsArray = Object.entries(packageTagCounts)
              .filter(([, count]) => count === tagIds.length)
              .map(([packageId]) => packageId);

            if (packageIdsWithAllTagsArray.length > 0) {
              query = query.in('id', packageIdsWithAllTagsArray);
            } else {
              // No packages have all selected tags
              return { packages: [], totalCount: 0 };
            }
          } else {
            // No packages with any of the selected tags
            return { packages: [], totalCount: 0 };
          }
        } else if (packageIdsWithAllTags && packageIdsWithAllTags.length > 0) {
          const packageIds = packageIdsWithAllTags.map(
            (p: { package_id: string }) => p.package_id
          );
          query = query.in('id', packageIds);
        } else {
          // No packages have all selected tags
          return { packages: [], totalCount: 0 };
        }
      } else {
        // Selected tags don't exist in database
        return { packages: [], totalCount: 0 };
      }
    }

    // Apply folder/category filters (SERVER-SIDE, single RPC call)
    if (folder || category) {
      const { data: fcPackages, error: fcError } = await supabase.rpc(
        'get_package_ids_for_folder_category',
        { p_folder: folder ?? null, p_category: category ?? null }
      );

      if (fcError) throw fcError;

      const fcPackageIds = (fcPackages ?? []).map(
        (row: { package_id: string }) => row.package_id
      );
      if (fcPackageIds.length === 0) {
        // No packages match the folder/category filter
        return { packages: [], totalCount: 0 };
      }
      query = query.in('id', fcPackageIds);
    }

    // Apply various filters
    if (minStars !== null && minStars !== undefined) {
      query = query.gte('github_stars', minStars);
    }

    if (hasGithub) {
      query = query.not('repo_link', 'is', null);
    }

    if (hasWebserver) {
      query = query.not('webserver', 'is', null);
    }

    if (hasPublication) {
      query = query.not('publication', 'is', null);
    }

    if (minCitations !== null && minCitations !== undefined) {
      query = query.gte('citations', minCitations);
    }

    if (minRating !== null && minRating !== undefined) {
      query = query.gte('average_rating', minRating);
    }

    if (selectedLicenses.length > 0) {
      query = query.in('license', selectedLicenses);
    }

    // Apply sorting (with id tiebreaker for stable pagination across chunked fetches)
    if (sortBy && ALLOWED_SORT_COLUMNS.has(sortBy)) {
      const direction = sortDirection === 'asc';
      query = query.order(sortBy, { ascending: direction });
    }
    query = query.order('id', { ascending: true });

    // Apply pagination (AFTER all filters are applied)
    if (page && pageSize) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      query = query.range(start, end);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    let userRatings: Map<string, { rating: number; rating_id: string }> | undefined;

    // Fetch user ratings if requested and user is authenticated
    if (includeUserRatings && currentUserId && data) {
      const packageIds = data.map(pkg => pkg.id);
      if (packageIds.length > 0) {
        const { data: ratingsData } = await supabase
          .from('ratings')
          .select('package_id, rating, id')
          .eq('user_id', currentUserId)
          .in('package_id', packageIds);

        if (ratingsData) {
          userRatings = new Map(
            ratingsData.map((rating: { package_id: string; rating: number; id: string }) => [
              rating.package_id,
              { rating: rating.rating, rating_id: rating.id }
            ])
          );
        }
      }
    }

    // Transform nested data to match existing Package type
    const packages = (data || []).map(transformPackageData);

    return {
      packages,
      totalCount: count || 0,
      userRatings
    };
    })(), 30000); // 30 second timeout
  },

  async getAllPackagesForExport(
    filters: PackageFilters,
    options: { chunkSize?: number; hardCap?: number } = {}
  ): Promise<{ packages: PackageWithNormalizedData[]; totalCount: number; truncated: boolean }> {
    const { chunkSize = 1000, hardCap = 10000 } = options;

    const baseFilters: PackageFilters = {
      ...filters,
      includeUserRatings: false,
      currentUserId: null,
    };

    const allPackages: PackageWithNormalizedData[] = [];
    let totalCount = 0;
    let page = 1;
    let truncated = false;

    while (allPackages.length < hardCap) {
      const remaining = hardCap - allPackages.length;
      const pageSize = Math.min(chunkSize, remaining);

      const result = await packageApi.getPackages({
        ...baseFilters,
        page,
        pageSize,
      });

      if (page === 1) totalCount = result.totalCount;

      allPackages.push(...result.packages);

      if (result.packages.length < pageSize) break;
      if (allPackages.length >= totalCount) break;

      page++;
    }

    if (totalCount > hardCap) truncated = true;

    return { packages: allPackages, totalCount, truncated };
  },

  async getPackageById(id: string): Promise<PackageWithNormalizedData> {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        package_folder_categories!left (
          folder_categories (
            folders (name),
            categories (name)
          )
        ),
        package_tags!left (
          tags (name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Package not found');

    return transformPackageData(data);
  },

  async createPackage(packageData: Partial<PackageWithNormalizedData>): Promise<PackageWithNormalizedData> {
    const { tags, folder, category, ...restData } = packageData;

    const { data, error } = await supabase
      .from('packages')
      .insert(restData)
      .select()
      .single();

    if (error) throw error;

    // Handle tags and folder/category in transactions
    if (tags && tags.length > 0) {
      await supabase.rpc('update_package_tags', {
        package_uuid: data.id,
        new_tags: tags
      });
    }

    if (folder && category) {
      await supabase.rpc('update_package_folder_category', {
        package_uuid: data.id,
        folder_name: folder,
        category_name: category
      });
    }

    return packageApi.getPackageById(data.id);
  },

  async updatePackage(id: string, updates: Partial<PackageWithNormalizedData>): Promise<PackageWithNormalizedData> {
    const { tags, folder, category, ...restData } = updates;

    const { error } = await supabase
      .from('packages')
      .update(restData)
      .eq('id', id);

    if (error) throw error;

    // Handle tags update
    if (tags !== undefined) {
      await supabase.rpc('update_package_tags', {
        package_uuid: id,
        new_tags: tags
      });
    }

    // Handle folder/category update
    if (folder !== undefined || category !== undefined) {
      await supabase.rpc('update_package_folder_category', {
        package_uuid: id,
        folder_name: folder || null,
        category_name: category || null
      });
    }

    return packageApi.getPackageById(id);
  },

  async deletePackage(id: string): Promise<void> {
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Raw `packages` row shape as returned by the Supabase joins in this module
// (covers both the getPackages and getPackageById select shapes).
interface RawPackageRow extends Package {
  package_tags?: ({ tags?: { name?: string } | null } | null)[] | null;
  package_folder_categories?: ({
    folder_categories?: {
      folders?: { name?: string } | null;
      categories?: { name?: string } | null;
    } | null;
  } | null)[] | null;
}

// Helper function to transform nested data
function transformPackageData(data: RawPackageRow): PackageWithNormalizedData {
  return {
    ...data,
    folder: data.package_folder_categories?.[0]?.folder_categories?.folders?.name || '',
    category: data.package_folder_categories?.[0]?.folder_categories?.categories?.name || '',
    tags: data.package_tags?.map((pt) => pt?.tags?.name).filter(Boolean) as string[] || [],
  };
}