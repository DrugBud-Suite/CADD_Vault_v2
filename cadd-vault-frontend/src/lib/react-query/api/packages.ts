import { supabase } from '../../../supabase';
import { Package } from '../../../types';

export interface PackageFilters {
  searchTerm?: string;
  selectedTags?: string[];
  minStars?: number | null;
  hasGithub?: boolean;
  hasWebserver?: boolean;
  hasPublication?: boolean;
  minCitations?: number | null;
  minRating?: number | null;
  folder1?: string | null;
  category1?: string | null;
  selectedLicenses?: string[];
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeUserRatings?: boolean;
  currentUserId?: string | null;
}

export interface PackageQueryResult {
  packages: Package[];
  totalCount: number;
  userRatings?: Map<string, { rating: number; rating_id: string }>;
}

export const packageApi = {
  async getPackages(filters: PackageFilters = {}): Promise<PackageQueryResult> {
    const {
      searchTerm,
      selectedTags = [],
      minStars,
      hasGithub,
      hasWebserver,
      hasPublication,
      minCitations,
      minRating,
      folder1,
      category1,
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

        // Get packages that have ALL selected tags
        for (const tagId of tagIds) {
          // Get package IDs that have this tag
          const { data: packageIds } = await supabase
            .from('package_tags')
            .select('package_id')
            .eq('tag_id', tagId);

          if (packageIds && packageIds.length > 0) {
            const pkgIds = packageIds.map(p => p.package_id);
            query = query.in('id', pkgIds);
          } else {
            // If any tag has no packages, return empty result
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }
    }

    // Apply folder/category filters (SERVER-SIDE)
    if (folder1 || category1) {
      let folderCategoryQuery = supabase
        .from('folder_categories')
        .select('id');

      if (folder1) {
        const { data: folderData } = await supabase
          .from('folders')
          .select('id')
          .eq('name', folder1)
          .single();

        if (folderData) {
          folderCategoryQuery = folderCategoryQuery.eq('folder_id', folderData.id);
        }
      }

      if (category1) {
        const { data: categoryData } = await supabase
          .from('categories')
          .select('id')
          .eq('name', category1)
          .single();

        if (categoryData) {
          folderCategoryQuery = folderCategoryQuery.eq('category_id', categoryData.id);
        }
      }

      const { data: fcData } = await folderCategoryQuery;
      if (fcData && fcData.length > 0) {
        const fcIds = fcData.map(fc => fc.id);
        
        // Get package IDs that have these folder/category combinations
        const { data: packageIds } = await supabase
          .from('package_folder_categories')
          .select('package_id')
          .in('folder_category_id', fcIds);
        
        if (packageIds && packageIds.length > 0) {
          const pkgIds = packageIds.map(p => p.package_id);
          query = query.in('id', pkgIds);
        } else {
          // If no packages match the folder/category filter, return empty result
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
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

    // Apply sorting
    if (sortBy) {
      const direction = sortDirection === 'asc';
      query = query.order(sortBy, { ascending: direction });
    }

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
            ratingsData.map((rating: any) => [
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
  },

  async getPackageById(id: string): Promise<Package> {
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

  async createPackage(packageData: Partial<Package>): Promise<Package> {
    const { tags, folder1, category1, ...restData } = packageData;

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

    if (folder1 && category1) {
      await supabase.rpc('update_package_folder_category', {
        package_uuid: data.id,
        folder_name: folder1,
        category_name: category1
      });
    }

    return packageApi.getPackageById(data.id);
  },

  async updatePackage(id: string, updates: Partial<Package>): Promise<Package> {
    const { tags, folder1, category1, ...restData } = updates;

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
    if (folder1 !== undefined || category1 !== undefined) {
      await supabase.rpc('update_package_folder_category', {
        package_uuid: id,
        folder_name: folder1 || null,
        category_name: category1 || null
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

// Helper function to transform nested data
function transformPackageData(data: any): Package {
  return {
    ...data,
    folder1: data.package_folder_categories?.[0]?.folder_categories?.folders?.name || null,
    category1: data.package_folder_categories?.[0]?.folder_categories?.categories?.name || null,
    tags: data.package_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) as string[] || [],
  };
}