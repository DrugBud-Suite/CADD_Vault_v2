// src/services/dataService.ts
import { supabase } from '../supabase';
import { Package, PackageWithRelations } from '../types';

export interface FilterMetadata {
	allAvailableTags: string[];
	allAvailableLicenses: string[];
	allAvailableFolders: string[];
	allAvailableCategories: Record<string, string[]>;
    datasetMaxStars: number;
    datasetMaxCitations: number;
	totalPackageCount: number;
}

export interface PackageQueryResult {
    packages: Package[];
    totalCount: number;
    userRatings?: Map<string, { rating: number; rating_id: string }>;
}

export interface PackageQueryParams {
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

export class DataService {
    /**
     * Fetch packages with normalized relationships
     */
	static async fetchPackages(params: PackageQueryParams): Promise<PackageQueryResult> {
		const {
			searchTerm,
			selectedTags = [],
			minStars = null,
			hasGithub,
			hasWebserver,
			hasPublication,
			minCitations = null,
			minRating = null,
            folder1 = null,
            category1 = null,
			selectedLicenses = [],
			sortBy = 'package_name',
			sortDirection = 'asc',
			page = 1,
            pageSize = 50,
			includeUserRatings = false,
			currentUserId = null
		} = params;

		try {
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
			if (searchTerm) {
				query = query.or(`package_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
			}

            // Apply tag filters
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

            // Apply folder/category filters
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

            // Apply other filters
            if (minStars !== null) {
				query = query.gte('github_stars', minStars);
			}

            if (hasGithub === true) {
				query = query.not('repo_link', 'is', null);
			}

            if (hasWebserver === true) {
				query = query.not('webserver', 'is', null);
			}

            if (hasPublication === true) {
				query = query.not('publication', 'is', null);
			}

            if (minCitations !== null) {
				query = query.gte('citations', minCitations);
			}

            if (minRating !== null) {
				query = query.gte('average_rating', minRating);
			}

			if (selectedLicenses.length > 0) {
				query = query.in('license', selectedLicenses);
			}

			// Apply sorting
			if (sortBy) {
                query = query.order(sortBy, { ascending: sortDirection === 'asc' });
			}

			// Apply pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            // Execute query
			const { data, error, count } = await query;

            if (error) throw error;

            // Transform the data to match Package interface
            const packages: Package[] = (data || []).map((pkg: PackageWithRelations) => ({
                ...pkg,
                tags: pkg.package_tags?.map(pt => pt.tags?.name).filter(Boolean) as string[] || [],
                folder1: pkg.package_folder_categories?.[0]?.folder_categories?.folders?.name || '',
                category1: pkg.package_folder_categories?.[0]?.folder_categories?.categories?.name || '',
            }));

            // Include user ratings if requested
            let userRatings: Map<string, { rating: number; rating_id: string }> | undefined;
            if (includeUserRatings && currentUserId) {
                const packageIds = packages.map(p => p.id);
                const { data: ratingsData } = await supabase
                    .from('ratings')
                    .select('package_id, rating, id')
                    .eq('user_id', currentUserId)
                    .in('package_id', packageIds);

                if (ratingsData) {
                    userRatings = new Map(
                        ratingsData.map(r => [r.package_id, { rating: r.rating, rating_id: r.id }])
                    );
                }
			}

			return {
				packages,
                totalCount: count || 0,
                userRatings
			};
		} catch (error) {
            console.error('Error fetching packages:', error);
			throw error;
		}
	}

    /**
     * Fetch unique tags from normalized table
     */
    static async fetchUniqueTags(): Promise<string[]> {
        console.log("  📌 Fetching unique tags...");
        const startTime = performance.now();

		try {
			const { data, error } = await supabase
                .from('tags')
                .select('name')
                .order('name');

			if (error) throw error;

            console.log(`  📌 Tags query completed in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
            return data?.map(tag => tag.name) || [];
		} catch (error) {
            console.error("  ❌ Failed to fetch tags:", error);
            throw error;
		}
	}

    /**
     * Fetch folders and categories from normalized tables
     */
    static async fetchFoldersAndCategories(): Promise<{
        folders: string[];
        categories: Record<string, string[]>;
    }> {
        console.log("  📁 Fetching folders and categories...");
        const startTime = performance.now();

		try {
			const { data, error } = await supabase
                .from('folder_categories')
                .select(`
                    folders!inner(name),
                    categories!inner(name)
                `)
                .order('folders(name), categories(name)');

            if (error) throw error;

            const folderCategoryMap: Record<string, string[]> = {};
            data?.forEach(item => {
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

            console.log(`  📁 Folders/Categories fetched in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

            return { folders, categories: folderCategoryMap };
		} catch (error) {
            console.error("  ❌ Failed to fetch folders/categories:", error);
            throw error;
		}
	}

    /**
     * Fetch packages with a specific tag using normalized structure
     */
    static async fetchPackagesWithTag(tagName: string): Promise<Package[]> {
		try {
            // Get tag ID
            const { data: tagData, error: tagError } = await supabase
                .from('tags')
                .select('id')
                .eq('name', tagName.trim())
                .single();

            if (tagError || !tagData) return [];

            // Fetch packages with this tag
            const { data, error } = await supabase
                .from('packages')
                .select(`
                    *,
                    package_tags!inner(tag_id),
                    package_tags!left(
                        tags!inner(id, name)
                    ),
                    package_folder_categories!left(
                        folder_categories!inner(
                            folders!inner(name),
                            categories!inner(name)
                        )
                    )
                `)
                .eq('package_tags.tag_id', tagData.id);

            if (error) throw error;

            // Transform to Package interface
            return (data || []).map((pkg: any) => ({
                ...pkg,
                tags: pkg.package_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) || [],
                folder1: pkg.package_folder_categories?.[0]?.folder_categories?.folders?.name || '',
                category1: pkg.package_folder_categories?.[0]?.folder_categories?.categories?.name || '',
            }));
        } catch (error) {
            console.error('Error fetching packages with tag:', error);
            throw error;
        }
    }

    static async fetchFilterMetadata(): Promise<FilterMetadata> {
        console.log("📊 Fetching filter metadata...");
        const startTime = performance.now();

        try {
            console.log("📊 Starting parallel metadata queries...");

            // Execute all queries in parallel
            const [tags, licenses, folderCategories, stats] = await Promise.all([
                this.fetchUniqueTags(),
                this.fetchUniqueLicenses(),
                this.fetchFoldersAndCategories(),
                this.fetchDatasetStats()
            ]);

            const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`📊 Metadata fetch completed in ${totalTime}s`);

            return {
                allAvailableTags: tags,
                allAvailableLicenses: licenses,
                allAvailableFolders: folderCategories.folders,
                allAvailableCategories: folderCategories.categories,
                datasetMaxStars: stats.maxStars || 0,
                datasetMaxCitations: stats.maxCitations || 0,
                totalPackageCount: stats.totalCount
            };
        } catch (error) {
            console.error("❌ Error fetching filter metadata:", error);
            throw error;
        }
    }

    static async fetchUniqueLicenses(): Promise<string[]> {
		console.log("  📜 Fetching unique licenses...");
		const startTime = performance.now();

		try {
			const licenseSet = new Set<string>();
			let from = 0;
			const batchSize = 1000;
			let hasMore = true;
			let totalRows = 0;

			while (hasMore) {
				const { data, error } = await supabase
					.from('packages')
					.select('license')
					.not('license', 'is', null)
					.range(from, from + batchSize - 1);

				if (error) {
					console.error("  ❌ Licenses query error:", error);
					throw error;
				}

				if (!data || data.length === 0) {
					hasMore = false;
					break;
				}

				data.forEach(row => {
					if (row.license && row.license.trim()) {
						licenseSet.add(row.license.trim());
					}
				});

				totalRows += data.length;
				hasMore = data.length === batchSize;
				from += batchSize;
			}

			console.log(`  📜 Licenses query completed, processed ${totalRows} total rows in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

			return Array.from(licenseSet).sort();
		} catch (error) {
			console.error("  ❌ Failed to fetch licenses:", error);
			throw error;
		}
    }

    static async fetchDatasetStats(): Promise<{
		maxStars: number | null;
		maxCitations: number | null;
		totalCount: number;
	}> {
		console.log("  📊 Fetching dataset statistics...");
		const startTime = performance.now();

		try {
			// Get max stars
			console.log("    ⭐ Fetching max stars...");
			const { data: starsData, error: starsError } = await supabase
				.from('packages')
				.select('github_stars')
				.not('github_stars', 'is', null)
				.order('github_stars', { ascending: false })
				.limit(1);

			if (starsError) {
				console.error("    ❌ Max stars query error:", starsError);
				throw starsError;
			}

			// Get max citations
			console.log("    📚 Fetching max citations...");
			const { data: citationsData, error: citationsError } = await supabase
				.from('packages')
				.select('citations')
				.not('citations', 'is', null)
				.order('citations', { ascending: false })
				.limit(1);

			if (citationsError) {
				console.error("    ❌ Max citations query error:", citationsError);
				throw citationsError;
			}

			// Get total count
			console.log("    🔢 Fetching total count...");
			const { count, error: countError } = await supabase
				.from('packages')
				.select('*', { count: 'exact', head: true });

			if (countError) {
				console.error("    ❌ Count query error:", countError);
				throw countError;
			}

			console.log(`  📊 Stats queries completed in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

			return {
				maxStars: starsData?.[0]?.github_stars || null,
				maxCitations: citationsData?.[0]?.citations || null,
				totalCount: count || 0
			};
		} catch (error) {
			console.error("  ❌ Failed to fetch dataset stats:", error);
			throw error;
		}
	}
    static applyTagFilters(query: any, tags: string[], logic: 'OR' | 'AND' | 'SINGLE' = 'OR') {
        if (tags.length === 0) return query;

        switch (logic) {
            case 'OR':
                // Used by main app - packages with ANY of the selected tags
                return query.filter('tags', 'cs', JSON.stringify(tags));

            case 'AND':
                // Used by admin bulk operations - packages with ALL selected tags
                tags.forEach(tag => {
                    query = query.contains('tags', [tag]);
                });
                return query;

            case 'SINGLE':
                // Used for single tag searches - packages containing exactly this tag
                return query.contains('tags', [tags[0]]);

            default:
                return query;
        }
    }

    /**
     * Refresh metadata and update the filter store
     */
    static async refreshFilterMetadata(): Promise<void> {
        console.log("🔄 Refreshing filter metadata...");
        try {
            const metadata = await this.fetchFilterMetadata();

            // Update the filter store with fresh metadata
            const { useFilterStore } = await import('../store/filterStore');
            useFilterStore.setState({
                allAvailableTags: metadata.allAvailableTags,
                allAvailableLicenses: metadata.allAvailableLicenses,
                allAvailableFolders: metadata.allAvailableFolders,
                allAvailableCategories: metadata.allAvailableCategories,
                datasetMaxStars: metadata.datasetMaxStars,
                datasetMaxCitations: metadata.datasetMaxCitations,
            });

            console.log("✅ Filter metadata refreshed successfully");
        } catch (error) {
            console.error("❌ Error refreshing filter metadata:", error);
            throw error;
        }
    }
}