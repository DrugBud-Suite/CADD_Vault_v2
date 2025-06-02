// src/services/dataService.ts
import { supabase } from '../supabase';
import { Package, PackageQueryResult } from '../types';

export interface FilterMetadata {
	allAvailableTags: string[];
	allAvailableLicenses: string[];
	allAvailableFolders: string[];
	allAvailableCategories: Record<string, string[]>;
	datasetMaxStars: number | null;
	datasetMaxCitations: number | null;
	totalPackageCount: number;
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
	// New parameter to include user ratings
	includeUserRatings?: boolean;
	currentUserId?: string | null;
}

export class DataService {
	/**
	 * Fetch filter metadata efficiently without loading all package data
	 */
	static async fetchFilterMetadata(): Promise<FilterMetadata> {
		console.log("📊 Fetching filter metadata...");
		const startTime = performance.now();

		try {
			console.log("📊 Starting parallel metadata queries...");

			// Fetch unique tags
			const tagsPromise = this.fetchUniqueTags()
				.then(result => {
					console.log(`✅ Tags fetched: ${result.length} unique tags`);
					return result;
				})
				.catch(error => {
					console.error("❌ Error fetching tags:", error);
					throw error;
				});

			// Fetch unique licenses
			const licensesPromise = this.fetchUniqueLicenses()
				.then(result => {
					console.log(`✅ Licenses fetched: ${result.length} unique licenses`);
					return result;
				})
				.catch(error => {
					console.error("❌ Error fetching licenses:", error);
					throw error;
				});

			// Fetch folders and categories
			const folderCategoriesPromise = this.fetchFoldersAndCategories()
				.then(result => {
					console.log(`✅ Folders/Categories fetched: ${result.folders.length} folders`);
					return result;
				})
				.catch(error => {
					console.error("❌ Error fetching folders/categories:", error);
					throw error;
				});

			// Fetch max values and count
			const statsPromise = this.fetchDatasetStats()
				.then(result => {
					console.log(`✅ Stats fetched: ${result.totalCount} total packages`);
					return result;
				})
				.catch(error => {
					console.error("❌ Error fetching stats:", error);
					throw error;
				});

			// Execute all queries in parallel
			const [tags, licenses, folderCategories, stats] = await Promise.all([
				tagsPromise,
				licensesPromise,
				folderCategoriesPromise,
				statsPromise
			]);

			const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
			console.log(`📊 Metadata fetch completed in ${totalTime}s`);

			return {
				allAvailableTags: tags,
				allAvailableLicenses: licenses,
				allAvailableFolders: folderCategories.folders,
				allAvailableCategories: folderCategories.categories,
				datasetMaxStars: stats.maxStars,
				datasetMaxCitations: stats.maxCitations,
				totalPackageCount: stats.totalCount
			};
		} catch (error) {
			console.error("❌ Error fetching filter metadata:", error);
			throw error;
		}
	}

	/**
	 * Refresh metadata and update the filter store
	 * This should be called after folder/category creation or when accessing admin pages
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

	/**
	 * Fetch packages with filters and pagination
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
			folder1,
			category1,
			selectedLicenses = [],
			sortBy = 'package_name',
			sortDirection = 'asc',
			page = 1,
			pageSize = 24,
			includeUserRatings = false,
			currentUserId = null
		} = params;

		const startTime = performance.now();
		const rangeFrom = (page - 1) * pageSize;
		const rangeTo = rangeFrom + pageSize - 1;

		console.log(`🔎 Fetching packages (page ${page})...`);

		try {
			let query = supabase
				.from('packages')
				.select('*', { count: 'exact' });

			// Apply filters
			if (searchTerm) {
				query = query.or(`package_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
			}

			if (selectedTags.length > 0) {
				// Use overlaps operator to check if any selected tag exists in the tags array
				// This creates an OR condition between tags
				query = query.overlaps('tags', selectedTags);
			}

			if (minStars !== null && minStars > 0) {
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

			if (minCitations !== null && minCitations > 0) {
				query = query.gte('citations', minCitations);
			}

			if (minRating !== null && minRating > 0) {
				query = query.gte('average_rating', minRating);
			}

			if (folder1) {
				query = query.eq('folder1', folder1);
			}

			if (category1) {
				query = query.eq('category1', category1);
			}

			if (selectedLicenses.length > 0) {
				query = query.in('license', selectedLicenses);
			}

			// Apply sorting
			if (sortBy) {
				query = query.order(sortBy, { ascending: sortDirection === 'asc', nullsFirst: false });
			}

			// Apply pagination
			query = query.range(rangeFrom, rangeTo);

			const { data, error, count } = await query;

			if (error) {
				throw error;
			}

			let packages = (data as Package[]) || [];

			// Fetch user ratings if requested and user is authenticated
			if (includeUserRatings && currentUserId && packages.length > 0) {
				console.log(`🔖 Fetching user ratings for ${packages.length} packages...`);

				const packageIds = packages.map(pkg => pkg.id);
				const userRatings = await this.fetchUserRatingsForPackages(packageIds, currentUserId);

				// Merge user rating data into packages
				packages = packages.map(pkg => ({
					...pkg,
					user_rating: userRatings.get(pkg.id)?.rating || null,
					user_rating_id: userRatings.get(pkg.id)?.rating_id || null
				}));
			}

			const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
			console.log(`🔎 Package fetch completed in ${totalTime}s. Total matches: ${count}, returned: ${packages.length}`);

			return {
				packages,
				totalCount: count || 0
			};
		} catch (error) {
			console.error("❌ Error fetching packages:", error);
			throw error;
		}
	}

	/**
	 * Fetch user ratings for multiple packages efficiently
	 */
	private static async fetchUserRatingsForPackages(
		packageIds: string[],
		userId: string
	): Promise<Map<string, { rating: number; rating_id: string }>> {
		try {
			const { data, error } = await supabase
				.from('ratings')
				.select('package_id, rating, id')
				.eq('user_id', userId)
				.in('package_id', packageIds);

			if (error) throw error;

			const ratingsMap = new Map<string, { rating: number; rating_id: string }>();

			if (data) {
				data.forEach(rating => {
					ratingsMap.set(rating.package_id, {
						rating: rating.rating,
						rating_id: rating.id
					});
				});
			}

			return ratingsMap;
		} catch (error) {
			console.error('Error fetching user ratings for packages:', error);
			// Return empty map on error - don't fail the entire request
			return new Map();
		}
	}

	/**
	 * Fetch user rating for a single package
	 */
	static async fetchUserRatingForPackage(
		packageId: string,
		userId: string
	): Promise<{ rating: number; rating_id: string } | null> {
		try {
			const { data, error } = await supabase
				.from('ratings')
				.select('rating, id')
				.eq('user_id', userId)
				.eq('package_id', packageId)
				.single();

			if (error) {
				if (error.code === 'PGRST116') {
					// No rating found
					return null;
				}
				throw error;
			}

			return {
				rating: data.rating,
				rating_id: data.id
			};
		} catch (error) {
			console.error('Error fetching user rating for package:', error);
			return null;
		}
	}

	/**
	 * Private helper methods
	 */	private static async fetchUniqueTags(): Promise<string[]> {
		console.log("  📌 Fetching unique tags...");
		const startTime = performance.now();

		try {
			const tagSet = new Set<string>();
			let from = 0;
			const batchSize = 1000;
			let hasMore = true;
			let totalRows = 0;

			while (hasMore) {
				const { data, error } = await supabase
					.from('packages')
					.select('tags')
					.not('tags', 'is', null)
					.range(from, from + batchSize - 1);

				if (error) {
					console.error("  ❌ Tags query error:", error);
					throw error;
				}

				if (!data || data.length === 0) {
					hasMore = false;
					break;
				}

				data.forEach(row => {
					if (row.tags && Array.isArray(row.tags)) {
						row.tags.forEach((tag: string) => {
							if (tag && tag.trim()) {
								tagSet.add(tag.trim());
							}
						});
					}
				});

				totalRows += data.length;
				hasMore = data.length === batchSize;
				from += batchSize;
			}

			console.log(`  📌 Tags query completed, processed ${totalRows} total rows in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

			return Array.from(tagSet).sort();
		} catch (error) {
			console.error("  ❌ Failed to fetch tags:", error);
			throw error;
		}
	 }
	private static async fetchUniqueLicenses(): Promise<string[]> {
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
	private static async fetchFoldersAndCategories(): Promise<{
		folders: string[];
		categories: Record<string, string[]>;
	}> {
		console.log("  📁 Fetching folders and categories...");
		const startTime = performance.now();

		try {
			const folderCategoryMap: Record<string, Set<string>> = {};
			let from = 0;
			const batchSize = 1000;
			let hasMore = true;
			let totalRows = 0;

			while (hasMore) {
				const { data, error } = await supabase
					.from('packages')
					.select('folder1, category1')
					.not('folder1', 'is', null)
					.range(from, from + batchSize - 1);

				if (error) {
					console.error("  ❌ Folders/categories query error:", error);
					throw error;
				}

				if (!data || data.length === 0) {
					hasMore = false;
					break;
				}

				data.forEach(row => {
					if (row.folder1) {
						if (!folderCategoryMap[row.folder1]) {
							folderCategoryMap[row.folder1] = new Set();
						}
						if (row.category1) {
							folderCategoryMap[row.folder1].add(row.category1);
						}
					}
				});

				totalRows += data.length;
				hasMore = data.length === batchSize;
				from += batchSize;
			}

			console.log(`  📁 Folders/categories query completed, processed ${totalRows} total rows in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

			const folders = Object.keys(folderCategoryMap).sort();
			const categories: Record<string, string[]> = {};

			for (const folder in folderCategoryMap) {
				categories[folder] = Array.from(folderCategoryMap[folder]).sort();
			}

			return { folders, categories };
		} catch (error) {
			console.error("  ❌ Failed to fetch folders/categories:", error);
			throw error;
		}
	}

	private static async fetchDatasetStats(): Promise<{
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
}