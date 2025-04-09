/**
 * Utility functions for formatting data
 */

/**
 * Format a date string to a relative time string (e.g. "2 months ago")
 * @param {string} dateString - Date string to format
 * @returns {string} Relative time string
 */
function formatRelativeTime(dateString) {
	if (!dateString) return 'Unknown';

	const date = new Date(dateString);
	const now = new Date();

	// Check for invalid date
	if (isNaN(date.getTime())) return 'Unknown';

	const diffInSeconds = Math.floor((now - date) / 1000);

	// Define time intervals in seconds
	const intervals = {
		year: 31536000,
		month: 2592000,
		week: 604800,
		day: 86400,
		hour: 3600,
		minute: 60
	};

	// Calculate the appropriate interval
	let count;
	let interval;

	if (diffInSeconds >= intervals.year) {
		count = Math.floor(diffInSeconds / intervals.year);
		interval = count === 1 ? 'year' : 'years';
	} else if (diffInSeconds >= intervals.month) {
		count = Math.floor(diffInSeconds / intervals.month);
		interval = count === 1 ? 'month' : 'months';
	} else if (diffInSeconds >= intervals.week) {
		count = Math.floor(diffInSeconds / intervals.week);
		interval = count === 1 ? 'week' : 'weeks';
	} else if (diffInSeconds >= intervals.day) {
		count = Math.floor(diffInSeconds / intervals.day);
		interval = count === 1 ? 'day' : 'days';
	} else if (diffInSeconds >= intervals.hour) {
		count = Math.floor(diffInSeconds / intervals.hour);
		interval = count === 1 ? 'hour' : 'hours';
	} else if (diffInSeconds >= intervals.minute) {
		count = Math.floor(diffInSeconds / intervals.minute);
		interval = count === 1 ? 'minute' : 'minutes';
	} else {
		return 'Just now';
	}

	return `${count} ${interval} ago`;
}

/**
 * Format a number with thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
	if (num === null || num === undefined) return '0';
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a number as compact (e.g. 1.2k, 3.4M)
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatCompactNumber(num) {
	if (!num) return '0';

	// Use built-in Intl formatter with compact notation
	return new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(num);
}

/**
 * Truncate a string to a maximum length and add ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
	if (!str) return '';
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength) + '...';
}

/**
 * Convert a snake_case or kebab-case string to title case
 * @param {string} str - String to convert
 * @returns {string} Title case string
 */
function toTitleCase(str) {
	if (!str) return '';

	// Replace underscores and hyphens with spaces
	const words = str.replace(/[_-]/g, ' ').split(' ');

	// Capitalize first letter of each word
	return words
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}