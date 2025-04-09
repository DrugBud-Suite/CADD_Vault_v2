/**
 * Service for managing packages data
 */
class PackagesService {
	/**
	 * Constructor
	 * @param {FirebaseFirestore} firestoreDB - Firestore database instance
	 */
	constructor(firestoreDB) {
		this.db = firestoreDB;
		this.packagesCollection = this.db.collection('packages');
		this.pageSize = 24; // Number of packages to load per page
		this.lastDoc = null; // For pagination
		this.allTags = new Map(); // Map of tag name to count
		this.filters = {
			searchTerm: '',
			selectedTags: [],
			hasGitHub: false,
			hasCitation: false,
			sortOption: 'name-asc'
		};
	}

	/**
	 * Initialize service - load and cache tags
	 */
	async init() {
		console.log('Initializing PackagesService...');
		await this.loadAllTags();
		return this;
	}

	/**
	 * Load all tags from the database and count occurrences
	 */
	async loadAllTags() {
		try {
			console.log('Loading all tags...');
			const snapshot = await this.packagesCollection.get();

			if (snapshot.empty) {
				console.warn('No packages found in database');
				return;
			}

			// Count tag occurrences
			snapshot.forEach(doc => {
				const packageData = doc.data();
				if (packageData.TAGS && Array.isArray(packageData.TAGS)) {
					packageData.TAGS.forEach(tag => {
						if (tag && tag.trim()) {
							const tagName = tag.trim();
							const currentCount = this.allTags.get(tagName) || 0;
							this.allTags.set(tagName, currentCount + 1);
						}
					});
				}
			});

			console.log(`Loaded ${this.allTags.size} unique tags`);
		} catch (error) {
			console.error('Error loading tags:', error);
			throw error;
		}
	}

	/**
	 * Get top N tags by occurrence count
	 * @param {number} limit - Number of tags to return
	 * @returns {Array} Array of tag objects with name and count
	 */
	async getTopTags(limit = 20) {
		if (this.allTags.size === 0) {
			await this.loadAllTags();
		}

		// Convert the Map to an array of objects and sort by count
		const tagsArray = Array.from(this.allTags.entries()).map(([name, count]) => ({
			name,
			count
		}));

		// Sort by count (descending)
		tagsArray.sort((a, b) => b.count - a.count);

		// Return the top N tags
		return tagsArray.slice(0, limit);
	}

	/**
	 * Get all tags
	 * @returns {Array} Array of tag objects with name and count
	 */
	getAllTags() {
		// Convert the Map to an array of objects
		return Array.from(this.allTags.entries()).map(([name, count]) => ({
			name,
			count
		}));
	}

	/**
	 * Set filters for querying packages
	 * @param {Object} filters - Filter options
	 */
	setFilters(filters) {
		this.filters = { ...this.filters, ...filters };
		// Reset pagination when filters change
		this.lastDoc = null;
	}

	/**
	 * Build a Firestore query based on current filters
	 * @returns {FirebaseFirestoreQuery} Firestore query
	 */
	buildQuery() {
		let query = this.packagesCollection;

		// Apply has GitHub filter
		if (this.filters.hasGitHub) {
			query = query.where('GITHUB_STARS', '>', 0);
		}

		// Apply has citation filter
		if (this.filters.hasCitation) {
			query = query.where('CITATIONS', '>', 0);
		}

		// Apply sorting
		const [field, direction] = this.filters.sortOption.split('-');

		switch (field) {
			case 'name':
				query = query.orderBy('ENTRY NAME', direction === 'asc' ? 'asc' : 'desc');
				break;
			case 'stars':
				query = query.orderBy('GITHUB_STARS', 'desc');
				break;
			case 'citations':
				query = query.orderBy('CITATIONS', 'desc');
				break;
			case 'rating':
				query = query.orderBy('averageRating', 'desc');
				break;
			case 'updated':
				query = query.orderBy('LAST_COMMIT', 'desc');
				break;
			default:
				query = query.orderBy('ENTRY NAME', 'asc');
		}

		// Apply pagination
		if (this.lastDoc) {
			query = query.startAfter(this.lastDoc);
		}

		// Limit results
		query = query.limit(this.pageSize);

		return query;
	}

	/**
	 * Get packages based on current filters
	 * @param {boolean} isLoadMore - Whether this is a "load more" request
	 * @returns {Object} Object containing packages array and metadata
	 */
	async getPackages(isLoadMore = false) {
		try {
			if (!isLoadMore) {
				// Reset pagination for new queries
				this.lastDoc = null;
			}

			const query = this.buildQuery();
			const snapshot = await query.get();

			if (snapshot.empty) {
				console.log('No packages match the current filters');
				return {
					packages: [],
					hasMore: false
				};
			}

			// Update lastDoc for pagination
			this.lastDoc = snapshot.docs[snapshot.docs.length - 1];

			// Extract packages data
			const packages = snapshot.docs.map(doc => ({
				id: doc.id,
				...doc.data()
			}));

			// Filter by tags and search term in memory
			// We have to do this in memory because Firestore doesn't support array-contains-all
			// and for search across multiple fields
			const filteredPackages = this.filterPackagesInMemory(packages);

			// Check if there are more results
			const hasMore = filteredPackages.length === this.pageSize;

			return {
				packages: filteredPackages,
				hasMore
			};
		} catch (error) {
			console.error('Error getting packages:', error);
			throw error;
		}
	}

	/**
	 * Search packages
	 * @param {string} searchTerm - Search term
	 * @returns {Object} Object containing packages array and metadata
	 */
	async searchPackages(searchTerm) {
		this.setFilters({ searchTerm });
		return this.getPackages();
	}

	/**
	 * Filter packages in memory for complex filters that Firestore doesn't support
	 * @param {Array} packages - Array of packages to filter
	 * @returns {Array} Filtered packages
	 */
	filterPackagesInMemory(packages) {
		return packages.filter(pkg => {
			// Filter by tags
			if (this.filters.selectedTags.length > 0) {
				if (!pkg.TAGS || !Array.isArray(pkg.TAGS)) return false;

				// Check if package has all selected tags
				const hasAllTags = this.filters.selectedTags.every(tag =>
					pkg.TAGS.includes(tag)
				);

				if (!hasAllTags) return false;
			}

			// Filter by search term
			if (this.filters.searchTerm) {
				const searchTerm = this.filters.searchTerm.toLowerCase();

				// Search in entry name, code, and description
				const nameMatch = pkg['ENTRY NAME'] && pkg['ENTRY NAME'].toLowerCase().includes(searchTerm);
				const codeMatch = pkg.CODE && pkg.CODE.toLowerCase().includes(searchTerm);
				const descMatch = pkg.DESCRIPTION && pkg.DESCRIPTION.toLowerCase().includes(searchTerm);

				if (!nameMatch && !codeMatch && !descMatch) return false;
			}

			return true;
		});
	}

	/**
	 * Rate a package
	 * @param {string} packageId - Package ID
	 * @param {number} rating - Rating value (1-5)
	 * @returns {Object} Updated rating info
	 */
	async ratePackage(packageId, rating) {
		try {
			const packageRef = this.packagesCollection.doc(packageId);
			const packageDoc = await packageRef.get();

			if (!packageDoc.exists) {
				throw new Error('Package not found');
			}

			const packageData = packageDoc.data();
			const userRatings = packageData.userRatings || {};

			// Use a simple anonymous ID for demo
			// In a real app, you'd use authentication
			const userId = 'anonymous_' + Math.floor(Math.random() * 1000000);

			// Update ratings
			userRatings[userId] = rating;

			// Calculate new average
			const ratingValues = Object.values(userRatings);
			const newAverage = ratingValues.reduce((acc, val) => acc + val, 0) / ratingValues.length;
			const newCount = ratingValues.length;

			// Update in Firestore
			await packageRef.update({
				userRatings: userRatings,
				averageRating: newAverage,
				ratingCount: newCount
			});

			return {
				averageRating: newAverage,
				ratingCount: newCount
			};
		} catch (error) {
			console.error('Error rating package:', error);
			throw error;
		}
	}

	/**
	 * Get package by ID
	 * @param {string} packageId - Package ID
	 * @returns {Object} Package data
	 */
	async getPackageById(packageId) {
		try {
			const packageDoc = await this.packagesCollection.doc(packageId).get();

			if (!packageDoc.exists) {
				throw new Error('Package not found');
			}

			return {
				id: packageDoc.id,
				...packageDoc.data()
			};
		} catch (error) {
			console.error('Error getting package:', error);
			throw error;
		}
	}
}