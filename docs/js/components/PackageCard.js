/**
 * PackageCard component for rendering package cards
 */
class PackageCard {
	/**
	 * Create a package card
	 * @param {Object} pkg - Package data
	 * @param {Function} onCardClick - Click handler for the card
	 * @param {Function} onRatingClick - Click handler for rating stars
	 * @returns {HTMLElement} Card element
	 */
	static create(pkg, onCardClick, onRatingClick) {
		const lastCommitAgo = pkg['LAST_COMMIT_AGO'] || 'Unknown';
		const githubStars = pkg['GITHUB_STARS'] || 0;
		const citations = pkg['CITATIONS'] || 0;
		const rating = pkg['averageRating'] || 0;
		const ratingCount = pkg['ratingCount'] || 0;

		// Create card element
		const card = document.createElement('div');
		card.className = 'package-card';
		card.dataset.id = pkg.id;

		// Generate HTML for card
		card.innerHTML = `
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
				<span>${formatCompactNumber(githubStars)}</span>
			  </div>
			` : ''}
			
			${citations ? `
			  <div class="meta-item">
				<span class="material-icons-round">description</span>
				<span>${formatCompactNumber(citations)} citations</span>
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
			${PackageCard.generateStarRating(rating)}
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
	  `;

		// Add event listeners
		card.addEventListener('click', (e) => {
			// Don't trigger card click when clicking on rating stars
			if (!e.target.closest('.star-rating')) {
				onCardClick(pkg);
			}
		});

		// Add star rating event listeners
		const stars = card.querySelectorAll('.star');
		stars.forEach((star, index) => {
			// Rate on click
			star.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent card click
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

		return card;
	}

	/**
	 * Generate HTML for star rating
	 * @param {number} rating - Rating value (0-5)
	 * @returns {string} HTML string
	 */
	static generateStarRating(rating) {
		let html = '';
		for (let i = 1; i <= 5; i++) {
			const starClass = i <= rating ? 'star filled' : 'star';
			html += `<span class="material-icons-round ${starClass}" data-rating="${i}">star</span>`;
		}
		return html;
	}

	/**
	 * Update the rating display on a card
	 * @param {HTMLElement} cardElement - Card element
	 * @param {number} rating - New rating value
	 * @param {number} ratingCount - New rating count
	 */
	static updateRating(cardElement, rating, ratingCount) {
		const ratingElement = cardElement.querySelector('.star-rating');
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
		if (!countElement && ratingCount > 0) {
			countElement = document.createElement('span');
			countElement.className = 'star-count';
			ratingElement.appendChild(countElement);
		}

		if (countElement) {
			countElement.textContent = `(${ratingCount})`;
		}
	}
}