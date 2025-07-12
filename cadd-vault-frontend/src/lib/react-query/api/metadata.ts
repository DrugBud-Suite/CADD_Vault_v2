import { supabase } from '../../../supabase';

export interface FilterMetadata {
  allAvailableTags: string[];
  allAvailableLicenses: string[];
  allAvailableFolders: string[];
  allAvailableCategories: Record<string, string[]>;
  datasetMaxStars: number;
  datasetMaxCitations: number;
  totalPackageCount: number;
}

export interface DatasetStatistics {
  maxStars: number | null;
  maxCitations: number | null;
  totalCount: number;
}

export interface FolderCategoryData {
  folders: string[];
  categories: Record<string, string[]>;
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
    const allAvailableTags = tagsResult.data?.map((tag: any) => tag.name) || [];

    // Process licenses (get unique values)
    const allAvailableLicenses = Array.from(
      new Set(licensesResult.data?.map((pkg: any) => pkg.license).filter(Boolean))
    ).sort();

    // Process folders and categories
    const foldersData = foldersResult.data || [];
    const folderCategoryMap: Record<string, string[]> = {};
    foldersData.forEach((item: any) => {
      const folderName = (item.folders as any)?.name;
      const categoryName = (item.categories as any)?.name;
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

  async getTags(): Promise<string[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('name')
      .order('name');

    if (error) throw error;
    return data?.map((tag: any) => tag.name) || [];
  },

  async getLicenses(): Promise<string[]> {
    const { data, error } = await supabase
      .from('packages')
      .select('license')
      .not('license', 'is', null);

    if (error) throw error;

    return Array.from(
      new Set(data?.map((pkg: any) => pkg.license).filter(Boolean))
    ).sort();
  },

  async getFoldersAndCategories(): Promise<FolderCategoryData> {
    const { data, error } = await supabase
      .from('folder_categories')
      .select(`
        folders!inner(name),
        categories!inner(name)
      `)
      .order('folders(name), categories(name)');

    if (error) throw error;

    const folderCategoryMap: Record<string, string[]> = {};
    data?.forEach((item: any) => {
      const folderName = (item.folders as any)?.name;
      const categoryName = (item.categories as any)?.name;
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

    const folders = Object.keys(folderCategoryMap).sort();
    return { folders, categories: folderCategoryMap };
  },

  async getDatasetStats(): Promise<DatasetStatistics> {
    const [starsResult, citationsResult, countResult] = await Promise.all([
      supabase.from('packages').select('github_stars').not('github_stars', 'is', null).order('github_stars', { ascending: false }).limit(1),
      supabase.from('packages').select('citations').not('citations', 'is', null).order('citations', { ascending: false }).limit(1),
      supabase.from('packages').select('id', { count: 'exact', head: true })
    ]);

    if (starsResult.error) throw starsResult.error;
    if (citationsResult.error) throw citationsResult.error;
    if (countResult.error) throw countResult.error;

    return {
      maxStars: starsResult.data?.[0]?.github_stars || null,
      maxCitations: citationsResult.data?.[0]?.citations || null,
      totalCount: countResult.count || 0,
    };
  },
};