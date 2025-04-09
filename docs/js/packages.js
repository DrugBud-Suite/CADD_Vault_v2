// Packages class to handle data fetching and rendering
class PackagesManager {
	constructor() {
		this.packagesCollection = db.collection('packages');
		this.allPackages = [];
		this.filteredPackages = [];
		this.selectedTags = [];
		this.searchTerm = '';
		this.sortOption = 'name-asc';
		this.allTags = new Set();
	}

	// Initialize the packages manager
	async init() {
		try {
			await this.fetchPackages();
			this.extractAllTags();
			this.renderTagFilters();
			this.applyFilters();
			this.renderPackages();
			this.setupEventListeners();
		} catch (error) {
			console.error('Error initializing packages manager:', error);
			document.getElementById('loading-indicator').textContent = 'Error loading packages. Please try again later.';
		}
	}

	// Fetch all packages from Firestore
	async fetchPackages() {
		try {
			document.getElementById('loading-indicator').style.display = 'block';

			const snapshot = await this.packagesCollection.get();
			this.allPackages = snapshot.docs.map(doc => ({
				id: doc.id,
				...doc.data()
			}));

			document.getElementById('loading-indicator').style.display = 'none';
			document.getElementById('packages-count').textContent = `(${this.allPackages.length})`;
		} catch (error) {
			console.error('Error fetching packages:', error);
			throw error;
		}
	}

	// Extract all unique tags from packages
	extractAllTags() {
		this.allPackages.forEach(pkg => {
			if (pkg.TAGS && Array.isArray(pkg.TAGS)) {
				pkg.TAGS.forEach(tag => {
					if (tag && tag.trim()) {
						this.allTags.add(tag.trim());
					}
				});
			}
		});
	}

	// Render tag filters in the UI
	renderTagFilters() {
		const tagsContainer = document.getElementById('tags-filter');
		tagsContainer.innerHTML = '';

		// Sort tags alphabetically
		const sortedTags = Array.from(this.allTags).sort();

		// Display the most common tags (limit to 20 for UI clarity)
		sortedTags.slice(0, 20).forEach(tag => {
			const tagElement = document.createElement('div');
			tagElement.className = 'tag';
			tagElement.textContent = tag;

			if (this.selectedTags.includes(tag)) {
				tagElement.classList.add('selected');
			}

			tagElement.addEventListener('click', () => {
				this.toggleTagFilter(tag, tagElement);
			});

			tagsContainer.appendChild(tagElement);
		});
	}

	// Toggle tag selection for filtering
	toggleTagFilter(tag, element) {
		if (this.selectedTags.includes(tag)) {
			this.selectedTags = this.selectedTags.filter(t => t !== tag);
			element.classList.remove('selected');
		} else {
			this.selectedTags.push(tag);
			element.classList.add('selected');
		}

		this.applyFilters();
		this.renderPackages();
	}

	// Apply all filters and sorting
	applyFilters() {
		// Start with all packages
		this.filteredPackages = [...this.allPackages];

		// Apply search filter
		if (this.searchTerm) {
			const searchLower = this.searchTerm.toLowerCase();
			this.filteredPackages = this.filteredPackages.filter(pkg =>
				(pkg['ENTRY NAME'] && pkg['ENTRY NAME'].toLowerCase().includes(searchLower)) ||
				(pkg['DESCRIPTION'] && pkg['DESCRIPTION'].toLowerCase().includes(searchLower)) ||
				(pkg['CODE'] && pkg['CODE'].toLowerCase().includes(searchLower))
			);
		}

		// Apply tag filters
		if (this.selectedTags.length > 0) {
			this.filteredPackages = this.filteredPackages.filter(pkg => {
				if (!pkg.TAGS || !Array.isArray(pkg.TAGS)) return false;
				return this.selectedTags.every(tag => pkg.TAGS.includes(tag));
			});
		}

		// Apply sorting
		this.applySorting();

		// Update count
		document.getElementById('packages-count').textContent = `(${this.filteredPackages.length})`;
	}

	// Apply sorting based on selected option
	applySorting() {
		const [field, direction] = this.sortOption.split('-');

		this.filteredPackages.sort((a, b) => {
			let valueA, valueB;

			switch (field) {
				case 'name':
					valueA = a['ENTRY NAME'] || '';
					valueB = b['ENTRY NAME'] || '';
					break;
				case 'stars':
					valueA = a['GITHUB_STARS'] || 0;
					valueB = b['GITHUB_STARS'] || 0;
					break;
				case 'citations':
					valueA = a['CITATIONS'] || 0;
					valueB = b['CITATIONS'] || 0;
					break;
				case 'rating':
					valueA = a['averageRating'] || 0;
					valueB = b['averageRating'] || 0;
					break;
				case 'updated':
					valueA = a['LAST_COMMIT'] ? new Date(a['LAST_COMMIT']) : new Date(0);
					valueB = b['LAST_COMMIT'] ? new Date(b['LAST_COMMIT']) : new Date(0);
					break;
				default:
					valueA = a['ENTRY NAME'] || '';
					valueB = b['ENTRY NAME'] || '';
			}

			// For strings, use localeCompare
			if (typeof valueA === 'string' && typeof valueB === 'string') {
				return direction === 'asc'
					? valueA.localeCompare(valueB)
					: valueB.localeCompare(valueA);
			}

			// For dates, compare timestamps
			if (valueA instanceof Date && valueB instanceof Date) {
				return direction === 'asc'
					? valueA.getTime() - valueB.getTime()
					: valueB.getTime() - valueA.getTime();
			}

			// For numbers, simple comparison
			return direction === 'asc' ? valueA - valueB : valueB - valueA;
		});
	}

	// Render packages to the UI
	renderPackages() {
		const packagesGrid = document.getElementById('packages-grid');
		packagesGrid.innerHTML = '';

		if (this.filteredPackages.length === 0) {
			document.getElementById('no-results').style.display = 'block';
		} else {
			document.getElementById('no-results').style.display = 'none';

			this.filteredPackages.forEach(pkg => {
				const card = this.createPackageCard(pkg);
				packagesGrid.appendChild(card);
			});
		}
	}

	// Create a package card element
	createPackageCard(pkg) {
		const card = document.createElement('div');
		card.className = 'package-card';
		card.dataset.id = pkg.id;

		const lastCommitAgo = pkg['LAST_COMMIT_AGO'] || 'Unknown';
		const githubStars = pkg['GITHUB_STARS'] || 0;
		const citations = pkg['CITATIONS'] || 0;
		const rating = pkg['averageRating'] || 0;
		const ratingCount = pkg['ratingCount'] || 0;

		card.innerHTML = `
		<div class="package-header">
		  <h3 class="package-title">${pkg['ENTRY NAME'] || 'Unnamed Package'}</h3>
		  ${pkg['CODE'] ? `<span class="package-code">${pkg['CODE']}</span>` : ''}
		</div>
		<p class="package-description">${pkg['DESCRIPTION'] || 'No description available.'}</p>
		<div class="package-meta">
		  ${githubStars ? `
			<div class="meta-item">
			  <span class="material-icons">star</span>
			  <span>${githubStars}</span>
			</div>
		  ` : ''}
		  ${citations ? `
			<div class="meta-item">
			  <span class="material-icons">description</span>
			  <span>${citations} citations</span>
			</div>
		  ` : ''}
		  ${lastCommitAgo !== 'Unknown' ? `
			<div class="meta-item">
			  <span class="material-icons">update</span>
			  <span>${lastCommitAgo}</span>
			</div>
		  ` : ''}
		</div>
		<div class="star-rating" data-package-id="${pkg.id}">
		  ${this.generateStarRating(rating)}
		  ${ratingCount > 0 ? `<span class="star-count">(${ratingCount})</span>` : ''}
		</div>
		${pkg.TAGS && pkg.TAGS.length > 0 ? `
		  <div class="package-tags">
			${pkg.TAGS.slice(0, 3).map(tag => `<span class="package-tag">${tag}</span>`).join('')}
			${pkg.TAGS.length > 3 ? `<span class="package-tag">+${pkg.TAGS.length - 3} more</span>` : ''}
		  </div>
		` : ''}
	  `;

		// Open package details modal on click
		card.addEventListener('click', (e) => {
			// Don't open modal if clicking on star rating
			if (!e.target.closest('.star-rating')) {
				this.openPackageModal(pkg);
			}
		});

		// Set up star rating functionality
		const stars = card.querySelectorAll('.star');
		stars.forEach((star, index) => {
			star.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent card click event
				this.ratePackage(pkg.id, index + 1);
			});

			star.addEventListener('mouseover', () => {
				// Preview rating on hover
				for (let i = 0; i < stars.length; i++) {
					if (i <= index) {
						stars[i].classList.add('hover');
					} else {
						stars[i].classList.remove('hover');
					}
				}
			});

			star.addEventListener('mouseout', () => {
				// Remove hover effect
				stars.forEach(s => s.classList.remove('hover'));
			});
		});

		return card;
	}

	// Generate star rating HTML
	generateStarRating(rating) {
		let starsHtml = '';
		for (let i = 1; i <= 5; i++) {
			const starClass = i <= rating ? 'star filled' : 'star';
			starsHtml += `<span class="material-icons ${starClass}" data-rating="${i}">star</span>`;
		}
		return starsHtml;
	}

	// Handle package rating
	async ratePackage(packageId, rating) {
		try {
			const packageRef = this.packagesCollection.doc(packageId);
			const packageDoc = await packageRef.get();

			if (!packageDoc.exists) {
				console.error('Package not found');
				return;
			}

			const packageData = packageDoc.data();
			const userRatings = packageData.userRatings || {};

			// Use a simple anonymous ID for demo purposes
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

			// Update in local data
			this.updatePackageRating(packageId, newAverage, newCount);

			// Re-render packages to show updated rating
			this.renderPackages();

		} catch (error) {
			console.error('Error rating package:', error);
		}
	}

	// Update package rating in local data
	updatePackageRating(packageId, newRating, newCount) {
		// Update in all packages array
		const packageIndex = this.allPackages.findIndex(pkg => pkg.id === packageId);
		if (packageIndex !== -1) {
			this.allPackages[packageIndex].averageRating = newRating;
			this.allPackages[packageIndex].ratingCount = newCount;
		}

		// Update in filtered packages array
		const filteredIndex = this.filteredPackages.findIndex(pkg => pkg.id === packageId);
		if (filteredIndex !== -1) {
			this.filteredPackages[filteredIndex].averageRating = newRating;
			this.filteredPackages[filteredIndex].ratingCount = newCount;
		}
	}

	// Open package details modal
	openPackageModal(pkg) {
		const modal = document.getElementById('package-modal');
		const modalContent = document.getElementById('package-detail-content');

		// Format package data for modal
		modalContent.innerHTML = `
		<h2>${pkg['ENTRY NAME'] || 'Unnamed Package'}</h2>
		${pkg['CODE'] ? `<div class="package-code">${pkg['CODE']}</div>` : ''}
		
		<div class="modal-section">
		  <h3>Description</h3>
		  <p>${pkg['DESCRIPTION'] || 'No description available.'}</p>
		</div>
		
		${pkg['PUBLICATION'] ? `
		  <div class="modal-section">
			<h3>Publication</h3>
			<p>${pkg['PUBLICATION']}</p>
			${pkg['JOURNAL'] ? `<p>Journal: ${pkg['JOURNAL']}</p>` : ''}
			${pkg['CITATIONS'] ? `<p>Citations: ${pkg['CITATIONS']}</p>` : ''}
			${pkg['JIF'] ? `<p>Journal Impact Factor: ${pkg['JIF']}</p>` : ''}
		  </div>
		` : ''}
		
		<div class="modal-section">
		  <h3>GitHub Information</h3>
		  ${pkg['GITHUB_STARS'] ? `<p>Stars: ${pkg['GITHUB_STARS']}</p>` : ''}
		  ${pkg['LAST_COMMIT'] ? `<p>Last Commit: ${pkg['LAST_COMMIT']}</p>` : ''}
		  ${pkg['LAST_COMMIT_AGO'] ? `<p>Last Updated: ${pkg['LAST_COMMIT_AGO']}</p>` : ''}
		  ${pkg['LICENSE'] ? `<p>License: ${pkg['LICENSE']}</p>` : ''}
		</div>
		
		${pkg['WEBSERVER'] || pkg['LINK'] ? `
		  <div class="modal-section">
			<h3>Links</h3>
			${pkg['WEBSERVER'] ? `<p><a href="${pkg['WEBSERVER']}" target="_blank">Website</a></p>` : ''}
			${pkg['LINK'] ? `<p><a href="${pkg['LINK']}" target="_blank">Source Code</a></p>` : ''}
		  </div>
		` : ''}
		
		${pkg.TAGS && pkg.TAGS.length > 0 ? `
		  <div class="modal-section">
			<h3>Tags</h3>
			<div class="package-tags">
			  ${pkg.TAGS.map(tag => `<span class="package-tag">${tag}</span>`).join('')}
			</div>
		  </div>
		` : ''}
		
		<div class="modal-section">
		  <h3>User Rating</h3>
		  <div class="star-rating large" data-package-id="${pkg.id}">
			${this.generateStarRating(pkg['averageRating'] || 0)}
			${pkg['ratingCount'] > 0 ? `<span class="star-count">(${pkg['ratingCount']} ratings)</span>` : ''}
		  </div>
		</div>
	  `;

		// Show modal
		modal.style.display = 'block';

		// Set up close functionality
		const closeBtn = document.querySelector('.close-modal');
		closeBtn.onclick = function () {
			modal.style.display = 'none';
		};

		// Close modal when clicking outside
		window.onclick = function (event) {
			if (event.target === modal) {
				modal.style.display = 'none';
			}
		};
	}

	// Set up event listeners for search and sorting
	setupEventListeners() {
		// Search functionality
		const searchInput = document.getElementById('search-input');
		const searchBtn = document.getElementById('search-btn');

		searchInput.addEventListener('input', () => {
			this.searchTerm = searchInput.value;
			this.applyFilters();
			this.renderPackages();
		});

		searchBtn.addEventListener('click', () => {
			this.searchTerm = searchInput.value;
			this.applyFilters();
			this.renderPackages();
		});

		// Sort functionality
		const sortSelect = document.getElementById('sort-select');
		sortSelect.addEventListener('change', () => {
			this.sortOption = sortSelect.value;
			this.applyFilters();
			this.renderPackages();
		});
	}
}