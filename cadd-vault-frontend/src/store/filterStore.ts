// src/store/filterStore.ts
import { create } from 'zustand';
import { Package } from '../types';
import { filterPackages } from '../utils/filterPackages';
import { debounce } from 'lodash-es'; // Import debounce

// Define the shape of your filter state
type ViewMode = 'card' | 'list';

// Define only the data properties for easier use in applyFiltersAndSort
interface FilterData {
	searchTerm: string;
	selectedTags: string[];
	minStars: number | null;
	hasGithub: boolean;
	hasWebserver: boolean;
	hasPublication: boolean;
	minRating: number | null; // Keep if rating is still used elsewhere, otherwise remove
	minCitations: number | null;
	allAvailableTags: string[];
	folder1: string | null;
	category1: string | null;
	originalPackages: Package[];
	sortBy: string | null;
	sortDirection: 'asc' | 'desc';
	// Removed: selectedTypes, selectedSubtypes, selectedPlatforms
	selectedLicenses: string[];
}


interface FilterState extends FilterData {
	filteredPackages: Package[]; // Current filtered packages
	isFilterSidebarVisible: boolean;
	isNavSidebarVisible: boolean;
	viewMode: ViewMode;

	// Actions to update the state
	setSearchTerm: (term: string) => void;
	toggleTag: (tag: string) => void;
	addTag: (tag: string) => void;
	setSelectedTags: (tags: string[]) => void; // New action for Autocomplete
	setSelectedLicenses: (licenses: string[]) => void; // New action for Autocomplete
	setMinStars: (stars: number | null) => void;
	setHasGithub: (value: boolean) => void;
	setHasWebserver: (value: boolean) => void;
	setHasPublication: (value: boolean) => void;
	setMinRating: (rating: number | null) => void; // Keep if rating is still used elsewhere
	setMinCitations: (citations: number | null) => void;
	setFolder1: (folder: string | null) => void;
	setCategory1: (category: string | null) => void;
	setAllAvailableTags: (tags: string[]) => void;
	setOriginalPackages: (packages: Package[]) => void;
	clearFilters: () => void;
	setSort: (sortBy: string | null, direction?: 'asc' | 'desc') => void;
	setViewMode: (mode: ViewMode) => void;
	toggleFilterSidebar: () => void;
	toggleNavSidebar: () => void;

	// Removed: toggleType, toggleSubtype, togglePlatform
	toggleLicense: (license: string) => void;
	resetFilters: () => void;
	updateFilteredPackages: () => void;
}

// Define initial state values
const initialStateData: Omit<FilterState, 'filteredPackages' | 'isFilterSidebarVisible' | 'isNavSidebarVisible' | 'viewMode' | keyof FilterStateActions> & { viewMode: ViewMode } = {
	searchTerm: '',
	selectedTags: [],
	minStars: null,
	hasGithub: false,
	hasWebserver: false,
	hasPublication: false,
	minRating: null, // Keep if rating is still used elsewhere
	minCitations: null,
	folder1: null,
	category1: null,
	allAvailableTags: [],
	originalPackages: [],
	sortBy: 'package_name',
	sortDirection: 'asc',
	// Removed: selectedTypes, selectedSubtypes, selectedPlatforms
	selectedLicenses: [],
	viewMode: 'card', // Default view
};

const initialState: FilterState = {
	...initialStateData,
	filteredPackages: [],
	isFilterSidebarVisible: true,
	isNavSidebarVisible: true,
	// Actions will be added by zustand create function
	setSearchTerm: () => { },
	toggleTag: () => { },
	addTag: () => { },
	setSelectedTags: () => { }, // Add placeholder
	setSelectedLicenses: () => { }, // Add placeholder
	setMinStars: () => { },
	setHasGithub: () => { },
	setHasWebserver: () => { },
	setHasPublication: () => { },
	setMinRating: () => { }, // Keep if rating is still used elsewhere
	setMinCitations: () => { },
	setFolder1: () => { },
	setCategory1: () => { },
	setAllAvailableTags: () => { },
	setOriginalPackages: () => { },
	clearFilters: () => { },
	setSort: () => { },
	setViewMode: () => { },
	toggleFilterSidebar: () => { },
	toggleNavSidebar: () => { },
	// Removed: toggleType, toggleSubtype, togglePlatform
	toggleLicense: () => { },
	resetFilters: () => { },
	updateFilteredPackages: () => { },
};

// Define the actions separately for clarity
type FilterStateActions = Pick<FilterState,
	'setSearchTerm' | 'toggleTag' | 'addTag' | 'setSelectedTags' | 'setSelectedLicenses' | 'setMinStars' | 'setHasGithub' |
	'setHasWebserver' | 'setHasPublication' | 'setMinRating' | 'setMinCitations' |
	'setFolder1' | 'setCategory1' | 'setAllAvailableTags' | 'setOriginalPackages' |
	'clearFilters' | 'setSort' | 'setViewMode' | 'toggleFilterSidebar' |
	'toggleNavSidebar' | /* Removed: toggleType, toggleSubtype, togglePlatform */
	'toggleLicense' | 'resetFilters' | 'updateFilteredPackages'
>;


// Helper function to apply filters and sorting
const applyFiltersAndSort = (stateData: FilterData): Package[] => {
	const {
		originalPackages,
		searchTerm,
		selectedTags,
		minStars,
		hasGithub,
		hasWebserver,
		hasPublication,
		minCitations,
		folder1,
		category1,
		sortBy,
		sortDirection,
		// Removed: selectedTypes, selectedSubtypes, selectedPlatforms
		selectedLicenses
	} = stateData;

	// Apply base filters using the utility function
	// Note: filterPackages might need updates to handle hasGithub, hasWebserver, hasPublication correctly
	// if they are not simple boolean checks on existing properties.
	// Assuming filterPackages handles searchTerm, selectedTags, minStars, minCitations, folder1, category1
	let filtered = filterPackages(originalPackages, {
		searchTerm,
		selectedTags,
		minStars,
		hasGithub, // Pass these down
		hasWebserver, // Pass these down
		hasPublication, // Pass these down
		minCitations,
		folder1,
		category1,
	});

	// --- Removed redundant manual filtering block ---
	// The filterPackages utility function now handles all these criteria.

	// Filter by Checkboxes (License) - Keep this one as it wasn't in filterPackages
	if (selectedLicenses.length > 0) {
		// Ensure pkg.license_type exists and is a string
		filtered = filtered.filter(pkg => pkg.license && selectedLicenses.includes(pkg.license));
	}


	// Apply sorting
	if (sortBy) {
		filtered = [...filtered].sort((a, b) => {
			let valA: any = a[sortBy as keyof Package];
			let valB: any = b[sortBy as keyof Package];

			// Handle potential null/undefined values
			if (valA == null) valA = sortDirection === 'asc' ? Infinity : -Infinity;
			if (valB == null) valB = sortDirection === 'asc' ? Infinity : -Infinity;

			// Specific handling for different types
			if (sortBy === 'last_commit' && typeof valA === 'string' && typeof valB === 'string') {
				// Attempt to parse dates if they are strings
				const dateA = new Date(valA);
				const dateB = new Date(valB);
				if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
					valA = dateA.getTime();
					valB = dateB.getTime();
				}
			} else if (sortBy === 'last_commit' && valA instanceof Date && valB instanceof Date) {
				valA = valA.getTime();
				valB = valB.getTime();
			} else if (typeof valA === 'string' && typeof valB === 'string') {
				valA = valA.toLowerCase();
				valB = valB.toLowerCase();
			} else if (typeof valA === 'number' && typeof valB === 'number') {
				// Standard number comparison
			}


			let comparison = 0;
			if (valA < valB) {
				comparison = -1;
			} else if (valA > valB) {
				comparison = 1;
			}

			return sortDirection === 'desc' ? comparison * -1 : comparison;
		});
	}

	return filtered;
};

// Helper to get the data part of the state
const getStateData = (state: FilterState): FilterData => {
	const {
		searchTerm, selectedTags, minStars, hasGithub, hasWebserver, hasPublication,
		minRating, minCitations, allAvailableTags, folder1, category1, originalPackages,
		sortBy, sortDirection, /* Removed: selectedTypes, selectedSubtypes, selectedPlatforms */ selectedLicenses
	} = state;
	return {
		searchTerm, selectedTags, minStars, hasGithub, hasWebserver, hasPublication,
		minRating, minCitations, allAvailableTags, folder1, category1, originalPackages,
		sortBy, sortDirection, /* Removed */ selectedLicenses
	};
};


// Create the store
export const useFilterStore = create<FilterState>()((set, get) => ({ // Add 'get' if needed later
	// Initial State Properties
	searchTerm: initialStateData.searchTerm,
	selectedTags: initialStateData.selectedTags,
	minStars: initialStateData.minStars,
	hasGithub: initialStateData.hasGithub,
	hasWebserver: initialStateData.hasWebserver,
	hasPublication: initialStateData.hasPublication,
	minRating: initialStateData.minRating,
	minCitations: initialStateData.minCitations,
	folder1: initialStateData.folder1,
	category1: initialStateData.category1,
	allAvailableTags: initialStateData.allAvailableTags,
	originalPackages: initialStateData.originalPackages,
	sortBy: initialStateData.sortBy,
	sortDirection: initialStateData.sortDirection,
	selectedLicenses: initialStateData.selectedLicenses,
	viewMode: initialStateData.viewMode,
	filteredPackages: [], // Start with empty filtered list
	isFilterSidebarVisible: true, // Default visibility
	isNavSidebarVisible: true, // Default visibility
	allAvailableLicenses: [], // Add this if needed based on setOriginalPackages logic

	// Actions
	setSearchTerm: debounce((term: string) => {
		set((state) => {
			const newStateData = { ...getStateData(state), searchTerm: term };
			return {
				searchTerm: term,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	}, 300),

	toggleTag: (tag: string) => {
		set((state) => {
			const newTags = state.selectedTags.includes(tag)
				? state.selectedTags.filter((t) => t !== tag)
				: [...state.selectedTags, tag];
			const newStateData = { ...getStateData(state), selectedTags: newTags };
			return {
				selectedTags: newTags,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	addTag: (tag: string) => {
		set((state) => {
			if (!state.selectedTags.includes(tag)) {
				const newTags = [...state.selectedTags, tag];
				const newStateData = { ...getStateData(state), selectedTags: newTags };
				return {
					selectedTags: newTags,
					filteredPackages: applyFiltersAndSort(newStateData),
				};
			}
			return {}; // Return empty object if no change
		});
	},

	setSelectedTags: (tags: string[]) => {
		set((state) => {
			const newStateData = { ...getStateData(state), selectedTags: tags };
			return {
				selectedTags: tags,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setSelectedLicenses: (licenses: string[]) => {
		set((state) => {
			const newStateData = { ...getStateData(state), selectedLicenses: licenses };
			return {
				selectedLicenses: licenses,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setMinStars: (stars: number | null) => {
		set((state) => {
			const newStars = stars !== null && !isNaN(stars) && stars >= 0 ? Number(stars) : null;
			const newStateData = { ...getStateData(state), minStars: newStars };
			return {
				minStars: newStars,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setHasGithub: (value: boolean) => {
		set((state) => {
			const newStateData = { ...getStateData(state), hasGithub: value };
			return {
				hasGithub: value,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setHasWebserver: (value: boolean) => {
		set((state) => {
			const newStateData = { ...getStateData(state), hasWebserver: value };
			return {
				hasWebserver: value,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setHasPublication: (value: boolean) => {
		set((state) => {
			const newStateData = { ...getStateData(state), hasPublication: value };
			return {
				hasPublication: value,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setMinRating: (rating: number | null) => {
		set((state) => {
			const newRating = rating !== null && rating >= 0 && rating <= 5 ? Number(rating) : null;
			const newStateData = { ...getStateData(state), minRating: newRating };
			return {
				minRating: newRating,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setMinCitations: (citations: number | null) => {
		set((state) => {
			const newCitations = citations !== null && !isNaN(citations) && citations >= 0 ? Number(citations) : null;
			const newStateData = { ...getStateData(state), minCitations: newCitations };
			return {
				minCitations: newCitations,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setFolder1: (folder: string | null) => {
		set((state) => {
			const newStateData = { ...getStateData(state), folder1: folder, category1: null }; // Reset category
			return {
				folder1: folder,
				category1: null,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setCategory1: (category: string | null) => {
		set((state) => {
			const newStateData = { ...getStateData(state), category1: category };
			return {
				category1: category,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setAllAvailableTags: (tags: string[]) => {
		set({ allAvailableTags: tags });
	},

	setOriginalPackages: (packages: Package[]) => {
		console.log(`Loaded ${packages.length} original packages.`);
		set((state) => {
			const newAllAvailableTags = [...new Set(packages.flatMap(p => p.tags || []))].sort();
			const newAllAvailableLicenses = [...new Set(packages.map(p => p.license).filter(Boolean) as string[])].sort();

			const newStateData = {
				...getStateData(state), // Get current filters
				originalPackages: packages, // Update packages
				allAvailableTags: newAllAvailableTags, // Update tags
				// Note: We don't put allAvailableLicenses into FilterData for applyFiltersAndSort
			};

			return {
				originalPackages: packages,
				allAvailableTags: newAllAvailableTags,
				allAvailableLicenses: newAllAvailableLicenses, // Store in state
				filteredPackages: applyFiltersAndSort(newStateData), // Apply initial filter
			};
		});
	},

	clearFilters: () => {
		set((state) => {
			// Keep original packages, available tags, licenses, sort, view mode etc.
			const resetData: FilterData = {
				...getStateData(state), // Get current state (includes packages, tags, sort etc.)
				// Reset only the filter criteria to defaults from initialStateData
				searchTerm: initialStateData.searchTerm,
				selectedTags: initialStateData.selectedTags,
				minStars: initialStateData.minStars,
				hasGithub: initialStateData.hasGithub,
				hasWebserver: initialStateData.hasWebserver,
				hasPublication: initialStateData.hasPublication,
				minRating: initialStateData.minRating,
				minCitations: initialStateData.minCitations,
				folder1: initialStateData.folder1,
				category1: initialStateData.category1,
				selectedLicenses: initialStateData.selectedLicenses,
			};
			return {
				// Update state with reset filter values
				searchTerm: resetData.searchTerm,
				selectedTags: resetData.selectedTags,
				minStars: resetData.minStars,
				hasGithub: resetData.hasGithub,
				hasWebserver: resetData.hasWebserver,
				hasPublication: resetData.hasPublication,
				minRating: resetData.minRating,
				minCitations: resetData.minCitations,
				folder1: resetData.folder1,
				category1: resetData.category1,
				selectedLicenses: resetData.selectedLicenses,
				// Recalculate filtered packages based on the reset filters
				filteredPackages: applyFiltersAndSort(resetData),
			};
		});
	},

	setSort: (newSortBy: string | null, newDirection?: 'asc' | 'desc') => {
		set((state) => {
			const direction = newDirection || (
				newSortBy === state.sortBy
					? (state.sortDirection === 'asc' ? 'desc' : 'asc')
					: 'asc'
			);
			const newStateData = { ...getStateData(state), sortBy: newSortBy, sortDirection: direction };
			return {
				sortBy: newSortBy,
				sortDirection: direction,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	setViewMode: (mode: ViewMode) => {
		set({ viewMode: mode });
	},

	toggleFilterSidebar: () => {
		set((state) => ({
			isFilterSidebarVisible: !state.isFilterSidebarVisible,
		}));
	},

	toggleNavSidebar: () => {
		set((state) => ({
			isNavSidebarVisible: !state.isNavSidebarVisible,
		}));
	},

	toggleLicense: (license: string) => {
		set((state) => {
			const newSelectedLicenses = state.selectedLicenses.includes(license)
				? state.selectedLicenses.filter((l: string) => l !== license)
				: [...state.selectedLicenses, license];
			const newStateData = { ...getStateData(state), selectedLicenses: newSelectedLicenses };
			return {
				selectedLicenses: newSelectedLicenses,
				filteredPackages: applyFiltersAndSort(newStateData),
			};
		});
	},

	// resetFilters is similar to clearFilters but might be intended differently?
	// Let's make it identical to clearFilters for now, as the previous implementation was complex.
	resetFilters: () => {
		set((state) => {
			const resetData: FilterData = {
				...getStateData(state),
				searchTerm: initialStateData.searchTerm,
				selectedTags: initialStateData.selectedTags,
				minStars: initialStateData.minStars,
				hasGithub: initialStateData.hasGithub,
				hasWebserver: initialStateData.hasWebserver,
				hasPublication: initialStateData.hasPublication,
				minRating: initialStateData.minRating,
				minCitations: initialStateData.minCitations,
				folder1: initialStateData.folder1,
				category1: initialStateData.category1,
				selectedLicenses: initialStateData.selectedLicenses,
			};
			return {
				searchTerm: resetData.searchTerm,
				selectedTags: resetData.selectedTags,
				minStars: resetData.minStars,
				hasGithub: resetData.hasGithub,
				hasWebserver: resetData.hasWebserver,
				hasPublication: resetData.hasPublication,
				minRating: resetData.minRating,
				minCitations: resetData.minCitations,
				folder1: resetData.folder1,
				category1: resetData.category1,
				selectedLicenses: resetData.selectedLicenses,
				filteredPackages: applyFiltersAndSort(resetData),
			};
		});
	},

	updateFilteredPackages: () => {
		set((state) => ({
			filteredPackages: applyFiltersAndSort(getStateData(state)),
		}));
	},
}));
