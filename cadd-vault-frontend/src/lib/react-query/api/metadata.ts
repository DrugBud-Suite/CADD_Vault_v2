import { supabase } from '../../../supabase';

interface TagRow { name: string; }
interface LicenseRow { license: string | null; }
interface FolderCategoryRow {
  folders: { name: string } | null;
  categories: { name: string } | null;
}

export interface FilterMetadata {
  allAvailableTags: string[];
  allAvailableLicenses: string[];
  allAvailableFolders: string[];
  allAvailableCategories: Record<string, string[]>;
  datasetMaxStars: number;
  datasetMaxCitations: number;
  totalPackageCount: number;
}

export const metadataApi = {
  async getFilterMetadata(): Promise<FilterMetadata> {
    // Execute all queries in parallel for better performance
    const [
      tagsResult,
      licensesResult,
      foldersResult,
      starsResult,
      citationsResult,
      countResult
    ] = await Promise.all([
      supabase.from('tags').select('name').order('name'),
      supabase.from('packages').select('license').not('license', 'is', null),
      supabase.from('folder_categories').select(`
        folders!inner(name),
        categories!inner(name)
      `).order('folders(name), categories(name)'),
      supabase.from('packages').select('github_stars').not('github_stars', 'is', null).order('github_stars', { ascending: false }).limit(1),
      supabase.from('packages').select('citations').not('citations', 'is', null).order('citations', { ascending: false }).limit(1),
      supabase.from('packages').select('id', { count: 'exact', head: true })
    ]);

    if (tagsResult.error) throw tagsResult.error;
    if (licensesResult.error) throw licensesResult.error;
    if (foldersResult.error) throw foldersResult.error;
    if (starsResult.error) throw starsResult.error;
    if (citationsResult.error) throw citationsResult.error;
    if (countResult.error) throw countResult.error;

    // Process tags
    const allAvailableTags = (tagsResult.data as TagRow[] | null)?.map((tag) => tag.name) || [];

    // Process licenses (get unique values)
    const allAvailableLicenses = Array.from(
      new Set((licensesResult.data as LicenseRow[] | null)?.map((pkg) => pkg.license).filter((l): l is string => l !== null && l !== undefined))
    ).sort();

    // Process folders and categories
    const foldersData = (foldersResult.data as unknown as FolderCategoryRow[] | null) || [];
    const folderCategoryMap: Record<string, string[]> = {};
    foldersData.forEach((item) => {
      const folderName = item.folders?.name;
      const categoryName = item.categories?.name;
      if (folderName && categoryName) {
        if (!folderCategoryMap[folderName]) {
          folderCategoryMap[folderName] = [];
        }
        if (!folderCategoryMap[folderName].includes(categoryName)) {
          folderCategoryMap[folderName].push(categoryName);
        }
      }
    });

    // Sort categories within each folder
    Object.keys(folderCategoryMap).forEach(folder => {
      folderCategoryMap[folder].sort();
    });

    const allAvailableFolders = Object.keys(folderCategoryMap).sort();

    return {
      allAvailableTags,
      allAvailableLicenses,
      allAvailableFolders,
      allAvailableCategories: folderCategoryMap,
      datasetMaxStars: starsResult.data?.[0]?.github_stars || 0,
      datasetMaxCitations: citationsResult.data?.[0]?.citations || 0,
      totalPackageCount: countResult.count || 0,
    };
  },
};
