/**
 * Main packages page controller with enhanced error handling
 */
class PackagesController {
	constructor() {
		// State
		this.isLoading = false;
		this.hasMorePackages = true;
		this.viewMode = 'grid'; // 'grid' or 'list'
		this.displayedTags = 20; // Number of tags to display initially

		// Detect if we're in development mode
		this.isDevelopment = window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1' ||
			window.location.hostname.includes('.gitpod.io');

		// Initialize error handler
		this.errorHandler = new ErrorHandler(this.isDevelopment);

		// DOM Elements
		this.packagesContainer = document.getElementById('packages-container');
		this.loadingIndicator = document.getElementById('loading-indicator');
		this.noResultsElement = document.getElementById('no-results');
		this.packagesCountElement = document.getElementById('packages-count');
		this.tagCloudElement = document.getElementById('tag-cloud');
		this.showMoreTagsButton = document.getElementById('show-more-tags');
		this.searchInput = document.getElementById('search-input');
		this.searchButton = document.getElementById('search-btn');
		this.sortSelect = document.getElementById('sort-select');
		this.clearFiltersButton = document.getElementById('clear-filters');
		this.hasGitHubToggle = document.getElementById('has-github');
		this.hasCitationToggle = document.getElementById('has-citation');
		this.viewGridButton = document.getElementById('view-grid');
		this.viewListButton = document.getElementById('view-list');
		this.loadMoreButton = document.getElementById('load-more');
		this.appliedFiltersContainer = document.getElementById('applied-filters');
		this.resetSearchButton = document.getElementById('reset-search');

		// Initialize services
		this.initServices();
	}

	/**
	 * Initialize the application
	 */
	async init() {
		try {
			// Show loading state
			this.setLoading(true);

			// Initialize services and load data
			await this.initializeData();

			// Set up event handlers
			this.setupEventListeners();

			// Check for URL params
			this.handleUrlParameters();

			// Hide loading state
			this.setLoading(false);
		} catch (error) {
			console.error('Error initializing app:', error);
			this.handleError(error);
		}
	}

	/**
	 * Initialize services
	 */
	initServices() {
		// Check if Firebase is initialized
		if (typeof firebase === 'undefined') {
			const error = new Error('Firebase SDK not loaded');
			console.error(error);
			this.handleError(this.errorHandler.handleFirebaseInitError(error));
			return;
		}

		// Check if Firestore is initialized
		if (typeof db === 'undefined') {
			const error = new Error('Firestore not initialized');
			console.error(error);
			this.handleError(this.errorHandler.handleFirebaseInitError(error));
			return;
		}

		// Create and initialize services
		this.packagesService = new PackagesService(db);
	}

	/**
	 * Initialize data
	 */
	async initializeData() {
		try {
			// Initialize packages service
			await this.packagesService.init();

			// Render tag cloud
			this.renderTagCloud();

			// Load initial packages
			await this.loadPackages();
		} catch (error) {
			console.error('Error initializing data:', error);

			// Determine error type and handle appropriately
			if (error.message && error.message.includes('permission-denied')) {
				throw new Error('Database access denied. Check Firestore security rules.');
			} else if (error.message && error.message.includes('network')) {
				throw new Error('Network error connecting to database. Check your internet connection.');
			} else {
				throw error;
			}
		}
	}

	/**
	 * Set up event listeners
	 */
	setupEventListeners() {
		// Search
		this.searchInput.addEventListener('input', this.debounce(() => {
			this.handleSearch();
		}, 300));

		this.searchButton.addEventListener('click', () => {
			this.handleSearch();
		});

		// Sort
		this.sortSelect.addEventListener('change', () => {
			this.handleSort(this.sortSelect.value);
		});

		// Clear filters
		this.clearFiltersButton.addEventListener('click', () => {
			this.clearAllFilters();
		});

		// Filters
		this.hasGitHubToggle.addEventListener('change', () => {
			this.handleFilterChange();
		});

		this.hasCitationToggle.addEventListener('change', () => {
			this.handleFilterChange();
		});

		// View mode
		this.viewGridButton.addEventListener('click', () => {
			this.setViewMode('grid');
		});

		this.viewListButton.addEventListener('click', () => {
			this.setViewMode('list');
		});

		// Load more
		this.loadMoreButton.addEventListener('click', () => {
			this.loadMorePackages();
		});

		// Show more tags
		this.showMoreTagsButton.addEventListener('click', () => {
			this.showMoreTags();
		});

		// Reset search
		this.resetSearchButton.addEventListener('click', () => {
			this.clearAllFilters();
		});
	}

	/**
	 * Handle URL parameters
	 */
	handleUrlParameters() {
		const urlParams = new URLSearchParams(window.location.search);

		// Handle tag parameter
		const tag = urlParams.get('tag');
		if (tag) {
			this.selectTag(tag);
		}

		// Handle search parameter
		const search = urlParams.get('search');
		if (search) {
			this.searchInput.value = search;
			this.handleSearch();
		}
	}

	/**
	 * Load packages based on current filters
	 */
	async loadPackages() {
		try {
			this.setLoading(true);

			const { packages, hasMore } = await this.packagesService.getPackages();

			this.hasMorePackages = hasMore;
			this.updatePackageCount(packages.length);

			// Render packages
			this.renderPackages(packages, false);

			// Update UI elements
			this.updateLoadMoreButton();
			this.updateAppliedFilters();

			this.setLoading(false);

			// Show no results if needed
			if (packages.length === 0) {
				this.showNoResults();
			}
		} catch (error) {
			console.error('Error loading packages:', error);
			this.handleError(this.errorHandler.handleDatabaseError(error));
		}
	}

	/**
	 * Load more packages
	 */
	async loadMorePackages() {
		if (!this.hasMorePackages || this.isLoading) return;

		try {
			this.setLoading(true);

			const { packages, hasMore } = await this.packagesService.getPackages(true);

			this.hasMorePackages = hasMore;

			// Render additional packages
			this.renderPackages(packages, true);

			// Update load more button
			this.updateLoadMoreButton();

			this.setLoading(false);
		} catch (error) {
			console.error('Error loading more packages:', error);
			this.handleError(this.errorHandler.handleDatabaseError(error));
		}
	}

	/**
	 * Handle search input
	 */
	handleSearch() {
		const searchTerm = this.searchInput.value.trim();
		this.packagesService.setFilters({ searchTerm });
		this.loadPackages();

		// Update URL
		const url = new URL(window.location);
		if (searchTerm) {
			url.searchParams.set('search', searchTerm);
		} else {
			url.searchParams.delete('search');
		}
		window.history.pushState({}, '', url);
	}

	/**
	 * Handle sort selection
	 * @param {string} sortOption - Sort option value
	 */
	handleSort(sortOption) {
		this.packagesService.setFilters({ sortOption });
		this.loadPackages();
	}

	/**
	 * Handle filter changes
	 */
	handleFilterChange() {
		const hasGitHub = this.hasGitHubToggle.checked;
		const hasCitation = this.hasCitationToggle.checked;

		this.packagesService.setFilters({ hasGitHub, hasCitation });
		this.loadPackages();
	}

	/**
	 * Toggle tag selection
	 * @param {string} tag - Tag to toggle
	 */
	toggleTag(tag) {
		const selectedTags = [...this.packagesService.filters.selectedTags];
		const tagIndex = selectedTags.indexOf(tag);

		if (tagIndex === -1) {
			// Add tag
			selectedTags.push(tag);
		} else {
			// Remove tag
			selectedTags.splice(tagIndex, 1);
		}

		this.packagesService.setFilters({ selectedTags });
		this.loadPackages();

		// Update tag cloud UI
		this.updateTagCloudSelection();

		// Update URL
		const url = new URL(window.location);
		if (selectedTags.length > 0) {
			url.searchParams.set('tag', selectedTags.join(','));
		} else {
			url.searchParams.delete('tag');
		}
		window.history.pushState({}, '', url);
	}

	/**
	 * Select a specific tag
	 * @param {string} tag - Tag to select
	 */
	selectTag(tag) {
		// Add tag if it exists
		const allTags = this.packagesService.getAllTags();
		const tagExists = allTags.some(t => t.name === tag);

		if (tagExists) {
			this.packagesService.setFilters({ selectedTags: [tag] });
			this.loadPackages();

			// Update tag cloud UI
			this.updateTagCloudSelection();
		}
	}

	/**
	 * Remove an applied filter
	 * @param {string} filterType - Type of filter to remove
	 * @param {string} value - Value of filter to remove
	 */
	removeFilter(filterType, value) {
		switch (filterType) {
			case 'tag':
				// Remove tag from selected tags
				const selectedTags = [...this.packagesService.filters.selectedTags];
				const tagIndex = selectedTags.indexOf(value);
				if (tagIndex !== -1) {
					selectedTags.splice(tagIndex, 1);
					this.packagesService.setFilters({ selectedTags });
				}
				break;

			case 'search':
				// Clear search
				this.searchInput.value = '';
				this.packagesService.setFilters({ searchTerm: '' });
				break;

			case 'github':
				// Uncheck GitHub toggle
				this.hasGitHubToggle.checked = false;
				this.packagesService.setFilters({ hasGitHub: false });
				break;

			case 'citation':
				// Uncheck citation toggle
				this.hasCitationToggle.checked = false;
				this.packagesService.setFilters({ hasCitation: false });
				break;
		}

		// Reload packages with updated filters
		this.loadPackages();

		// Update tag cloud UI
		this.updateTagCloudSelection();
	}

	/**
	 * Clear all filters
	 */
	clearAllFilters() {
		// Reset all filters
		this.searchInput.value = '';
		this.hasGitHubToggle.checked = false;
		this.hasCitationToggle.checked = false;
		this.sortSelect.value = 'name-asc';

		// Reset service filters
		this.packagesService.setFilters({
			searchTerm: '',
			selectedTags: [],
			hasGitHub: false,
			hasCitation: false,
			sortOption: 'name-asc'
		});

		// Reload packages
		this.loadPackages();

		// Update tag cloud UI
		this.updateTagCloudSelection();

		// Update URL
		window.history.pushState({}, '', window.location.pathname);
	}

	/**
	 * Rate a package
	 * @param {string} packageId - Package ID
	 * @param {number} rating - Rating value (1-5)
	 */
	async ratePackage(packageId, rating) {
		try {
			const ratingInfo = await this.packagesService.ratePackage(packageId, rating);

			// Update the rating UI
			this.updatePackageRating(packageId, ratingInfo);
		} catch (error) {
			console.error('Error rating package:', error);
			// Show error notification in development mode
			if (this.isDevelopment) {
				alert(`Error rating package: ${error.message}`);
			}
		}
	}

	/**
	 * Set loading state
	 * @param {boolean} isLoading - Whether the app is loading
	 */
	setLoading(isLoading) {
		this.isLoading = isLoading;

		if (isLoading) {
			this.loadingIndicator.innerHTML = `
				<div class="spinner"></div>
				<p>Loading packages...</p>
			`;
			this.loadingIndicator.style.display = 'flex';
		} else {
			this.loadingIndicator.style.display = 'none';
		}
	}

	/**
	 * Show the no results message
	 */
	showNoResults() {
		this.noResultsElement.style.display = 'block';
		this.packagesContainer.innerHTML = '';
	}

	/**
	 * Handle error
	 * @param {Error|Object} error - Error object or error info object
	 */
	handleError(error) {
		this.setLoading(false);

		let errorInfo;
		if (error instanceof Error) {
			// It's a raw error, process it with the error handler
			if (error.message.includes('permission-denied')) {
				errorInfo = this.errorHandler.handleDatabaseError(
					new Error('Permission denied accessing the database. Check Firestore security rules.')
				);
			} else if (error.message.includes('network')) {
				errorInfo = this.errorHandler.handleNetworkError(error);
			} else if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
				errorInfo = this.errorHandler.handleFirebaseInitError(error);
			} else {
				errorInfo = this.errorHandler.handleDatabaseError(error);
			}
		} else {
			// It's already an error info object
			errorInfo = error;
		}

		this.loadingIndicator.innerHTML = this.errorHandler.createErrorDisplay(errorInfo);
		this.loadingIndicator.style.display = 'flex';

		// Add retry button event listener
		const retryButton = document.getElementById('retry-button');
		if (retryButton) {
			retryButton.addEventListener('click', () => {
				this.loadPackages();
			});
		}

		// Add view console details button event listener for development
		const viewDetailsButton = document.getElementById('view-details-button');
		if (viewDetailsButton) {
			viewDetailsButton.addEventListener('click', () => {
				console.log('Error details:', error);
			});
		}
	}

	/**
	 * Show more tags
	 */
	showMoreTags() {
		// Increase the number of displayed tags
		this.displayedTags += 20;

		// Re-render tag cloud
		this.renderTagCloud();
	}

	/**
	 * Update tag cloud selection UI
	 */
	updateTagCloudSelection() {
		const selectedTags = this.packagesService.filters.selectedTags;

		// Reset all tags
		const tagElements = this.tagCloudElement.querySelectorAll('.tag');
		tagElements.forEach(tagElement => {
			tagElement.classList.remove('selected');
		});

		// Highlight selected tags
		selectedTags.forEach(tag => {
			const tagElement = this.tagCloudElement.querySelector(`.tag[data-tag="${tag}"]`);
			if (tagElement) {
				tagElement.classList.add('selected');
			}
		});
	}

	/**
	 * Render packages
	 * @param {Array} packages - Array of package objects
	 * @param {boolean} append - Whether to append or replace existing packages
	 */
	renderPackages(packages, append = false) {
		// Show no results message if no packages
		if (packages.length === 0 && !append) {
			this.noResultsElement.style.display = 'block';
			this.packagesContainer.innerHTML = '';
			return;
		} else {
			this.noResultsElement.style.display = 'none';
		}

		// Clear container if not appending
		if (!append) {
			this.packagesContainer.innerHTML = '';
		}

		// Set container class based on view mode
		this.packagesContainer.className = this.viewMode === 'grid' ? 'packages-grid' : 'packages-list';

		// Create and append package cards
		packages.forEach(pkg => {
			const cardHtml = this.createPackageCardHtml(pkg);

			const tempContainer = document.createElement('div');
			tempContainer.innerHTML = cardHtml;
			const card = tempContainer.firstElementChild;

			// Add event listeners
			this.addPackageCardEventListeners(card, pkg);

			// Append to container
			this.packagesContainer.appendChild(card);
		});
	}

	/**
	 * Create package card HTML
	 * @param {Object} pkg - Package object
	 * @returns {string} HTML string for package card
	 */
	createPackageCardHtml(pkg) {
		const lastCommitAgo = pkg['LAST_COMMIT_AGO'] || 'Unknown';
		const githubStars = pkg['GITHUB_STARS'] || 0;
		const citations = pkg['CITATIONS'] || 0;
		const rating = pkg['averageRating'] || 0;
		const ratingCount = pkg['ratingCount'] || 0;

		return `
		<div class="package-card" data-id="${pkg.id}">
		  <div class="package-info">
			<div class="package-header">
			  <h3 class="package-title">${pkg['ENTRY NAME'] || 'Unnamed Package'}</h3>
			  ${pkg['CODE'] ? `<div class="package-code">${pkg['CODE']}</div>` : ''}
			</div>
			
			<p class="package-description">${pkg['DESCRIPTION'] || 'No description available.'}</p>
		  </div>
		  
		  <div class="package-meta-container">
			<div class="package-meta">
			  ${githubStars ? `
				<div class="meta-item">
				  <span class="material-icons-round">star</span>
				  <span>${formatCompactNumber ? formatCompactNumber(githubStars) : githubStars}</span>
				</div>
			  ` : ''}
			  
			  ${citations ? `
				<div class="meta-item">
				  <span class="material-icons-round">description</span>
				  <span>${formatCompactNumber ? formatCompactNumber(citations) : citations} citations</span>
				</div>
			  ` : ''}
			  
			  ${lastCommitAgo !== 'Unknown' ? `
				<div class="meta-item">
				  <span class="material-icons-round">update</span>
				  <span>${lastCommitAgo}</span>
				</div>
			  ` : ''}
			</div>
			
			<div class="star-rating" data-package-id="${pkg.id}">
			  ${this.generateStarRatingHtml(rating)}
			  ${ratingCount > 0 ? `<span class="star-count">(${ratingCount})</span>` : ''}
			</div>
			
			${pkg.TAGS && pkg.TAGS.length > 0 ? `
			  <div class="package-tags">
				${pkg.TAGS.slice(0, 3).map(tag => `
				  <span class="package-tag">${tag}</span>
				`).join('')}
				${pkg.TAGS.length > 3 ? `<span class="package-tag">+${pkg.TAGS.length - 3}</span>` : ''}
			  </div>
			` : ''}
		  </div>
		</div>
	  `;
	}

	/**
	 * Add event listeners to package card
	 * @param {HTMLElement} card - Package card element
	 * @param {Object} pkg - Package object
	 */
	addPackageCardEventListeners(card, pkg) {
	// Open package details on click
		card.addEventListener('click', (e) => {
			// Don't open details if clicking on rating stars
			if (!e.target.closest('.star-rating')) {
				this.openPackageDetails(pkg);
			}
		});

		// Handle star rating
		const starRating = card.querySelector('.star-rating');
		if (starRating) {
			const stars = starRating.querySelectorAll('.star');
		stars.forEach((star, index) => {
			// Rate on click
			star.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent card click
				this.ratePackage(pkg.id, index + 1);
			});

			// Preview rating on hover
			star.addEventListener('mouseover', () => {
				for (let i = 0; i < stars.length; i++) {
					if (i <= index) {
						stars[i].classList.add('hover');
					} else {
						stars[i].classList.remove('hover');
					}
				}
			});

			// Remove hover effect
			star.addEventListener('mouseout', () => {
				stars.forEach(s => s.classList.remove('hover'));
			});
		});
		}
	}

	/**
	 * Generate star rating HTML
	 * @param {number} rating - Rating value (0-5)
	 * @returns {string} HTML string for star rating
	 */
	generateStarRatingHtml(rating) {
		let html = '';
		for (let i = 1; i <= 5; i++) {
			const starClass = i <= rating ? 'star filled' : 'star';
			html += `<span class="material-icons-round ${starClass}" data-rating="${i}">star</span>`;
		}
		return html;
	}

	/**
	 * Update package rating UI
	 * @param {string} packageId - Package ID
	 * @param {Object} ratingInfo - Rating information
	 */
	updatePackageRating(packageId, ratingInfo) {
		const { averageRating, ratingCount } = ratingInfo;

		// Find all instances of this package's rating (could be in grid and modal)
		const ratingElements = document.querySelectorAll(`.star-rating[data-package-id="${packageId}"]`);

		ratingElements.forEach(element => {
			// Update stars
			const stars = element.querySelectorAll('.star');
			stars.forEach((star, index) => {
				if (index < averageRating) {
					star.classList.add('filled');
				} else {
					star.classList.remove('filled');
				}
			});

			// Update count
			let countElement = element.querySelector('.star-count');
			if (!countElement) {
				countElement = document.createElement('span');
				countElement.className = 'star-count';
				element.appendChild(countElement);
			}

			countElement.textContent = `(${ratingCount})`;
		});
	}

	/**
	 * Open package details modal
	 * @param {Object} pkg - Package object
	 */
	openPackageDetails(pkg) {
		const modal = document.getElementById('package-modal');
		const modalContent = document.getElementById('package-detail-content');
		const modalTitle = document.getElementById('modal-title');

		// Set modal title
		modalTitle.textContent = pkg['ENTRY NAME'] || 'Package Details';

		// Format package data for modal
		modalContent.innerHTML = this.createPackageDetailHtml(pkg);

		// Add event listeners to stars in modal
		const starRating = modalContent.querySelector('.star-rating');
		if (starRating) {
			const stars = starRating.querySelectorAll('.star');
			stars.forEach((star, index) => {
				// Rate on click
				star.addEventListener('click', () => {
					this.ratePackage(pkg.id, index + 1);
				});

				// Preview rating on hover
				star.addEventListener('mouseover', () => {
					for (let i = 0; i < stars.length; i++) {
						if (i <= index) {
							stars[i].classList.add('hover');
						} else {
							stars[i].classList.remove('hover');
						}
					}
				});

				// Remove hover effect
				star.addEventListener('mouseout', () => {
					stars.forEach(s => s.classList.remove('hover'));
			});
			});
		}

		// Show modal
		modal.classList.add('visible');
		document.body.classList.add('modal-open');

		// Close modal when clicking close button
		const closeBtn = modal.querySelector('.close-modal');
		closeBtn.onclick = () => {
			this.closePackageDetails();
		};

		// Close modal when clicking outside
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				this.closePackageDetails();
		}
		});

		// Close modal on Escape key
		document.addEventListener('keydown', this.handleEscapeKey);
	}

	/**
	 * Close package details modal
	 */
	closePackageDetails() {
		const modal = document.getElementById('package-modal');
		modal.classList.remove('visible');
		document.body.classList.remove('modal-open');

		// Remove escape key handler
		document.removeEventListener('keydown', this.handleEscapeKey);
	}

	/**
	 * Handle Escape key press
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	handleEscapeKey = (e) => {
		if (e.key === 'Escape') {
			this.closePackageDetails();
		}
	}

	/**
	 * Create package detail HTML
	 * @param {Object} pkg - Package object
	 * @returns {string} HTML string for package details
	 */
	createPackageDetailHtml(pkg) {
		const lastCommitAgo = pkg['LAST_COMMIT_AGO'] || 'Unknown';
		const githubStars = pkg['GITHUB_STARS'] || 0;
		const citations = pkg['CITATIONS'] || 0;
		const rating = pkg['averageRating'] || 0;
		const ratingCount = pkg['ratingCount'] || 0;

		return `
		<div class="package-detail">
		  ${pkg['CODE'] ? `<div class="package-code">${pkg['CODE']}</div>` : ''}
		  
		  <section class="detail-section">
			<h3>Description</h3>
			<p>${pkg['DESCRIPTION'] || 'No description available.'}</p>
		  </section>
		  
		  <div class="detail-columns">
			<div class="detail-column">
			  ${pkg['PUBLICATION'] ? `
				<section class="detail-section">
				  <h3>Publication</h3>
				  <p>${pkg['PUBLICATION']}</p>
				  ${pkg['JOURNAL'] ? `<p class="detail-meta">Journal: ${pkg['JOURNAL']}</p>` : ''}
				  ${pkg['CITATIONS'] ? `<p class="detail-meta">Citations: ${formatNumber ? formatNumber(pkg['CITATIONS']) : pkg['CITATIONS']}</p>` : ''}
				  ${pkg['JIF'] ? `<p class="detail-meta">Journal Impact Factor: ${pkg['JIF']}</p>` : ''}
				</section>
			  ` : ''}
			  
			  <section class="detail-section">
				<h3>GitHub Information</h3>
				${githubStars ? `<p class="detail-meta">Stars: ${formatNumber ? formatNumber(githubStars) : githubStars}</p>` : ''}
				${pkg['LAST_COMMIT'] ? `<p class="detail-meta">Last Commit: ${pkg['LAST_COMMIT']}</p>` : ''}
				${lastCommitAgo !== 'Unknown' ? `<p class="detail-meta">Last Updated: ${lastCommitAgo}</p>` : ''}
				${pkg['LICENSE'] ? `<p class="detail-meta">License: ${pkg['LICENSE']}</p>` : ''}
			  </section>
			</div>
			
			<div class="detail-column">
			  ${pkg['WEBSERVER'] || pkg['LINK'] ? `
				<section class="detail-section">
				  <h3>Links</h3>
				  ${pkg['WEBSERVER'] ? `<p><a href="${pkg['WEBSERVER']}" target="_blank" class="detail-link">Website <span class="material-icons-round">open_in_new</span></a></p>` : ''}
				  ${pkg['LINK'] ? `<p><a href="${pkg['LINK']}" target="_blank" class="detail-link">Source Code <span class="material-icons-round">code</span></a></p>` : ''}
				</section>
			  ` : ''}
			  
			  ${pkg.TAGS && pkg.TAGS.length > 0 ? `
				<section class="detail-section">
				  <h3>Tags</h3>
				  <div class="package-tags detail-tags">
					${pkg.TAGS.map(tag => `<span class="package-tag">${tag}</span>`).join('')}
				  </div>
				</section>
			  ` : ''}
			  
			  <section class="detail-section">
				<h3>User Rating</h3>
				<div class="star-rating large" data-package-id="${pkg.id}">
				  ${this.generateStarRatingHtml(rating)}
				  ${ratingCount > 0 ? `<span class="star-count">(${ratingCount} ratings)</span>` : ''}
				</div>
				<p class="rating-help">Click to rate this package</p>
			  </section>
			</div>
		  </div>
		</div>
	  `;
	}

	/**
	 * Update package count display
	 * @param {number} count - Number of packages
	 */
	updatePackageCount(count) {
		this.packagesCountElement.textContent = count > 0 ? `(${count})` : '(0)';
	}

	/**
	 * Update load more button state
	 */
	updateLoadMoreButton() {
		if (this.hasMorePackages) {
			this.loadMoreButton.style.display = 'inline-flex';
		} else {
			this.loadMoreButton.style.display = 'none';
		}
	}

	/**
	 * Update applied filters UI
	 */
	updateAppliedFilters() {
		this.appliedFiltersContainer.innerHTML = '';

		const filters = this.packagesService.filters;
		let hasFilters = false;

		// Add search term
		if (filters.searchTerm) {
			this.addAppliedFilter('search', 'Search', filters.searchTerm);
			hasFilters = true;
		}

		// Add selected tags
		filters.selectedTags.forEach(tag => {
			this.addAppliedFilter('tag', 'Tag', tag);
			hasFilters = true;
		});

		// Add GitHub filter
		if (filters.hasGitHub) {
			this.addAppliedFilter('github', 'Filter', 'Has GitHub');
			hasFilters = true;
		}

		// Add citation filter
		if (filters.hasCitation) {
			this.addAppliedFilter('citation', 'Filter', 'Has Citation');
			hasFilters = true;
		}

		// Show/hide the container
		this.appliedFiltersContainer.style.display = hasFilters ? 'flex' : 'none';
	}

	/**
	 * Add applied filter UI element
	 * @param {string} type - Filter type
	 * @param {string} label - Filter label
	 * @param {string} value - Filter value
	 */
	addAppliedFilter(type, label, value) {
		const filterElement = document.createElement('div');
		filterElement.className = 'applied-filter';
		filterElement.innerHTML = `
		<span>${label}: ${value}</span>
		<span class="material-icons-round">close</span>
	  `;

		// Add click event to remove filter
		filterElement.addEventListener('click', () => {
			this.removeFilter(type, value);
		});

		this.appliedFiltersContainer.appendChild(filterElement);
	}

	/**
	 * Set view mode
	 * @param {string} mode - View mode ('grid' or 'list')
	 */
	setViewMode(mode) {
		this.viewMode = mode;

		// Update container class
		this.packagesContainer.className = mode === 'grid' ? 'packages-grid' : 'packages-list';

		// Update buttons
		this.viewGridButton.classList.toggle('active', mode === 'grid');
		this.viewListButton.classList.toggle('active', mode === 'list');

		// Store preference in local storage
		localStorage.setItem('viewMode', mode);
	}

	/**
	 * Debounce function to limit how often a function can be called
	 * @param {Function} func - Function to debounce
	 * @param {number} wait - Wait time in milliseconds
	 * @returns {Function} Debounced function
	 */
	debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	/**
	 * Render tag cloud
	 */
	renderTagCloud() {
		const allTags = this.packagesService.getAllTags();

		// Handle case where no tags are available
		if (allTags.length === 0) {
			this.tagCloudElement.innerHTML = `<em>No tags available</em>`;
			this.showMoreTagsButton.style.display = 'none';
			return;
		}

		// Sort tags alphabetically
		allTags.sort((a, b) => a.name.localeCompare(b.name));

		// Clear container
		this.tagCloudElement.innerHTML = '';

		// Show only the first N tags initially
		const tagsToShow = allTags.slice(0, this.displayedTags);

		// Create and append tag elements
		tagsToShow.forEach(tag => {
			const tagElement = document.createElement('div');
			tagElement.className = 'tag';
			tagElement.dataset.tag = tag.name;
			tagElement.innerHTML = `
		  <span class="tag-name">${tag.name}</span>
		  <span class="tag-count">${tag.count}</span>
		`;

			// Add click event listener
			tagElement.addEventListener('click', () => {
				this.toggleTag(tag.name);
			});

			this.tagCloudElement.appendChild(tagElement);
		});

		// Update tag selection
		this.updateTagCloudSelection();

		// Toggle show more tags button
		if (allTags.length > this.displayedTags) {
			this.showMoreTagsButton.style.display = 'block';
		} else {
			this.showMoreTagsButton.style.display = 'none';
		}
	}
}