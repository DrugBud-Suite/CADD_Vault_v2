/**
 * PackageModal component for displaying package details
 */
class PackageModal {
	/**
	 * Constructor
	 */
	constructor() {
		this.modal = document.getElementById('package-modal');
		this.modalTitle = document.getElementById('modal-title');
		this.modalContent = document.getElementById('package-detail-content');
		this.closeButton = this.modal.querySelector('.close-modal');

		// Initialize
		this.init();
	}

	/**
	 * Initialize the component
	 */
	init() {
		// Set up event listeners
		this.closeButton.addEventListener('click', () => this.close());

		// Close modal when clicking outside content
		this.modal.addEventListener('click', (e) => {
			if (e.target === this.modal) {
				this.close();
			}
		});

		// Close modal on escape key
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.isOpen()) {
				this.close();
			}
		});
	}

	/**
	 * Show the modal with package details
	 * @param {Object} pkg - Package data
	 * @param {Function} onRatingClick - Click handler for rating stars
	 */
	show(pkg, onRatingClick) {
		// Set modal title
		this.modalTitle.textContent = pkg['ENTRY NAME'] || 'Package Details';

		// Generate modal content
		this.modalContent.innerHTML = this.generateContent(pkg);

		// Add rating event listeners
		const starRating = this.modalContent.querySelector('.star-rating');
		if (starRating) {
			const stars = starRating.querySelectorAll('.star');
			stars.forEach((star, index) => {
				// Rate on click
				star.addEventListener('click', () => {
					onRatingClick(pkg.id, index + 1);
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
		this.modal.classList.add('visible');
		document.body.classList.add('modal-open');
	}

	/**
	 * Close the modal
	 */
	close() {
		this.modal.classList.remove('visible');
		document.body.classList.remove('modal-open');
	}

	/**
	 * Check if the modal is open
	 * @returns {boolean} True if modal is open
	 */
	isOpen() {
		return this.modal.classList.contains('visible');
	}

	/**
	 * Generate HTML content for the modal
	 * @param {Object} pkg - Package data
	 * @returns {string} HTML string
	 */
	generateContent(pkg) {
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
				  ${pkg['CITATIONS'] ? `<p class="detail-meta">Citations: ${formatNumber(pkg['CITATIONS'])}</p>` : ''}
				  ${pkg['JIF'] ? `<p class="detail-meta">Journal Impact Factor: ${pkg['JIF']}</p>` : ''}
				</section>
			  ` : ''}
			  
			  <section class="detail-section">
				<h3>GitHub Information</h3>
				${githubStars ? `<p class="detail-meta">Stars: ${formatNumber(githubStars)}</p>` : ''}
				${pkg['LAST_COMMIT'] ? `<p class="detail-meta">Last Commit: ${new Date(pkg['LAST_COMMIT']).toLocaleDateString()}</p>` : ''}
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
				  ${PackageCard.generateStarRating(rating)}
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
	 * Update rating display in the modal
	 * @param {string} packageId - Package ID
	 * @param {number} rating - New rating value
	 * @param {number} ratingCount - New rating count
	 */
	updateRating(packageId, rating, ratingCount) {
		const ratingElement = this.modalContent.querySelector(`.star-rating[data-package-id="${packageId}"]`);
		if (!ratingElement) return;

		// Update stars
		const stars = ratingElement.querySelectorAll('.star');
		stars.forEach((star, index) => {
			if (index < rating) {
				star.classList.add('filled');
			} else {
				star.classList.remove('filled');
			}
		});

		// Update count
		let countElement = ratingElement.querySelector('.star-count');
		if (!countElement) {
			countElement = document.createElement('span');
			countElement.className = 'star-count';
			ratingElement.appendChild(countElement);
		}

		countElement.textContent = `(${ratingCount} ratings)`;
	}
}