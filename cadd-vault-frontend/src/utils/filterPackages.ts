import { PackageWithNormalizedData } from '../types';

interface FilterCriteria {
	searchTerm: string;
	selectedTags: string[];
	minStars: number | null;
	hasGithub: boolean | null;
	hasWebserver: boolean | null;
	hasPublication: boolean | null;
	minCitations: number | null;
	folder: string | null;
	category: string | null;
}

export function filterPackages(
	packages: PackageWithNormalizedData[],
	criteria: FilterCriteria
): PackageWithNormalizedData[] {
	const {
		searchTerm,
		selectedTags,
		minStars,
		hasGithub,
		hasWebserver,
		hasPublication,
		minCitations,
		folder,
		category
	} = criteria;

	// If no filters are active, return all packages
	if (!searchTerm &&
		selectedTags.length === 0 &&
		minStars === null &&
		hasGithub === null &&
		hasWebserver === null &&
		hasPublication === null &&
		minCitations === null &&
		folder === null &&
		category === null
	) {
		return packages;
	}

	return packages.filter((pkg) => {
		// Search term filter
		if (searchTerm) {
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				// Search in package name
				pkg.package_name.toLowerCase().includes(searchLower) ||
				// Search in description if available
				(pkg.description && pkg.description.toLowerCase().includes(searchLower)) ||
				// Search in tags if available
				(pkg.tags && pkg.tags.some(tag => tag.toLowerCase().includes(searchLower))) ||
				// Search in GitHub owner/repo if available
				(pkg.repo_link && pkg.repo_link.toLowerCase().includes(searchLower));

			if (!matchesSearch) return false;
		}

		// Tags filter
		if (selectedTags.length > 0) {
			if (!pkg.tags || !selectedTags.every(tag => pkg.tags?.includes(tag))) {
				return false;
			}
		}

		// GitHub stars filter
		if (minStars !== null && (!pkg.github_stars || pkg.github_stars < minStars)) {
			return false;
		}

		// Has GitHub filter
		// Corrected Has GitHub filter: Only filter *for* presence when true
		if (hasGithub === true && !pkg.repo_link) {
			return false;
		}

		// Webserver filter
		// Corrected Webserver filter: Only filter *for* presence when true
		if (hasWebserver === true && !pkg.webserver) {
			return false;
		}

		// Publication filter
		// Corrected Publication filter: Only filter *for* presence when true
		if (hasPublication === true && !pkg.publication) {
			return false;
		}


		// Citations filter
		if (minCitations !== null && (!pkg.citations || pkg.citations < minCitations)) {
			return false;
		}

		// Folder filter
		if (folder !== null && pkg.folder !== folder) {
			return false;
		}

		// Category filter (only apply if folder is also selected)
		if (folder !== null && category !== null && pkg.category !== category) {
			return false;
		}


		return true;
	});
}