/**
 * TagCloud component for handling tag filters
 */
class TagCloud {
	/**
	 * Constructor
	 * @param {HTMLElement} container - Container element
	 * @param {Array} tags - Array of tag objects with name and count
	 * @param {Function} onTagClick - Callback function when tag is clicked
	 */
	constructor(container, tags, onTagClick) {
		this.container = container;
		this.tags = tags;
		this.onTagClick = onTagClick;
		this.selectedTags = [];
		this.displayLimit = 20; // Number of tags to display initially
	}

	/**
	 * Initialize the component
	 */
	init() {
		this.render();
	}

	/**
	 * Set selected tags
	 * @param {Array} selectedTags - Array of selected tag names
	 */
	setSelectedTags(selectedTags) {
		this.selectedTags = [...selectedTags];
		this.updateSelection();
	}

	/**
	 * Render the tag cloud
	 */
	render() {
		// Clear container
		this.container.innerHTML = '';

		// Only show limited number of tags initially
		const tagsToShow = this.tags.slice(0, this.displayLimit);

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

			this.container.appendChild(tagElement);
		});

		// Update selection state
		this.updateSelection();
	}

	/**
	 * Toggle a tag's selection
	 * @param {string} tagName - Tag name to toggle
	 */
	toggleTag(tagName) {
		const index = this.selectedTags.indexOf(tagName);

		if (index === -1) {
			// Add tag
			this.selectedTags.push(tagName);
		} else {
			// Remove tag
			this.selectedTags.splice(index, 1);
		}

		// Update UI
		this.updateSelection();

		// Call callback function
		if (this.onTagClick) {
			this.onTagClick(this.selectedTags);
		}
	}

	/**
	 * Update the selection state of tags in the UI
	 */
	updateSelection() {
		// Reset all tags
		const tagElements = this.container.querySelectorAll('.tag');
		tagElements.forEach(tagElement => {
			tagElement.classList.remove('selected');
		});

		// Highlight selected tags
		this.selectedTags.forEach(tagName => {
			const tagElement = this.container.querySelector(`.tag[data-tag="${tagName}"]`);
			if (tagElement) {
				tagElement.classList.add('selected');
			}
		});
	}

	/**
	 * Show more tags
	 * @param {number} additionalCount - Number of additional tags to show
	 */
	showMoreTags(additionalCount = 20) {
		this.displayLimit += additionalCount;
		this.render();
	}

	/**
	 * Get selected tags
	 * @returns {Array} Array of selected tag names
	 */
	getSelectedTags() {
		return [...this.selectedTags];
	}

	/**
	 * Clear all selected tags
	 */
	clearSelection() {
		this.selectedTags = [];
		this.updateSelection();
	}
}