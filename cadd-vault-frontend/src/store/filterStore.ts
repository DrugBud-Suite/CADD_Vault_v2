// src/store/filterStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PackageWithNormalizedData } from '../types';
import { debounce } from 'lodash-es';

type ViewMode = 'card' | 'list';

// Interface for the state
export interface FilterState { // Exporting for use in components
    searchTerm: string;
    selectedTags: string[];
    minStars: number | null;
    hasGithub: boolean;
    hasWebserver: boolean;
    hasPublication: boolean;
    minCitations: number | null;
    minRating: number | null; // New rating filter
    folder: string | null;
    category: string | null;
    selectedLicenses: string[];
    sortBy: string | null;
    sortDirection: 'asc' | 'desc';

    // Data related to the main package list (potentially paginated/filtered server-side)
    // These are set by HomePage after fetching data based on current filters
    displayedPackages: PackageWithNormalizedData[];
    totalFilteredCount: number; // Total packages matching current filters (from server)
    currentPage: number;
    pageSize: number; // Configurable page size (default 24, can be increased for virtualization)

    // Data derived from the entire dataset (for filter options, etc.)
    originalPackages: PackageWithNormalizedData[]; // Holds all packages, set once on initial load
    allAvailableTags: string[];    // Derived from originalPackages
    allAvailableLicenses: string[];// Derived from originalPackages
    allAvailableFolders: string[]; // Derived from originalPackages
    allAvailableCategories: Record<string, string[]>; // Categories per folder, derived

    datasetMaxStars: number | null;   // Max stars in the entire dataset, derived
    datasetMaxCitations: number | null; // Max citations in the entire dataset, derived

    viewMode: ViewMode;
    isFilterSidebarVisible: boolean;
    isNavSidebarVisible: boolean;

    // Actions
    setSearchTerm: (term: string) => void;
    setSelectedTags: (tags: string[]) => void;
    addTag: (tag: string) => void; // Added addTag action
    setMinStars: (stars: number | null) => void;
    setHasGithub: (has: boolean) => void;
    setHasWebserver: (has: boolean) => void;
    setHasPublication: (has: boolean) => void;
    setMinCitations: (citations: number | null) => void;
    setMinRating: (rating: number | null) => void; // New rating filter action
    setFolder: (folder: string | null) => void;
    setCategory: (category: string | null) => void;
    setSelectedLicenses: (licenses: string[]) => void;
    setSort: (field: string | null, direction?: 'asc' | 'desc') => void;

    // Actions for HomePage to update based on server response
    setDisplayedPackages: (packages: PackageWithNormalizedData[]) => void;
    setTotalFilteredCount: (count: number) => void;
    setCurrentPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;

    // Action to set the initial full dataset and derive all related metadata
    setOriginalPackagesAndDeriveMetadata: (packages: PackageWithNormalizedData[]) => void;

    // Action to refresh metadata from server
    refreshMetadata: () => Promise<void>;

    resetFilters: () => void;
    setViewMode: (mode: ViewMode) => void;
    toggleFilterSidebar: () => void;
    toggleNavSidebar: () => void;
}

// Initial static part of the state (values that don't depend on fetched data)
const initialStateValues: Omit<FilterState,
    // Omit actions
    'setSearchTerm' | 'setSelectedTags' | 'addTag' | 'setMinStars' | 'setHasGithub' |
    'setHasWebserver' | 'setHasPublication' | 'setMinCitations' | 'setMinRating' | 'setFolder' |
    'setCategory' | 'setSelectedLicenses' | 'setSort' | 'setDisplayedPackages' |
    'setTotalFilteredCount' | 'setCurrentPage' | 'setPageSize' | 'setOriginalPackagesAndDeriveMetadata' |
    'refreshMetadata' | 'resetFilters' | 'setViewMode' | 'toggleFilterSidebar' | 'toggleNavSidebar' |
    // Omit fields that will be derived or fetched
    'originalPackages' | 'allAvailableTags' | 'allAvailableLicenses' |
    'allAvailableFolders' | 'allAvailableCategories' | 'datasetMaxStars' |
    'datasetMaxCitations' | 'displayedPackages' | 'totalFilteredCount'
> = {
    searchTerm: '',
    selectedTags: [],
    minStars: null,
    hasGithub: false,
    hasWebserver: false,
    hasPublication: false,
    minCitations: null,
    minRating: null, // New rating filter initial value
    folder: null,
    category: null,
    selectedLicenses: [],
    sortBy: 'package_name',
    sortDirection: 'asc',
    viewMode: 'card',
    currentPage: 1,
    pageSize: 100, // Default page size optimized for virtualization
    isFilterSidebarVisible: true,
    isNavSidebarVisible: true,
};

export const useFilterStore = create<FilterState>()(
    persist(
        (set, get) => ({
            ...initialStateValues, // Spread initial static values

            // Initialize fields that will be derived/fetched
            originalPackages: [],
            allAvailableTags: [],
            allAvailableLicenses: [],
            allAvailableFolders: [],
            allAvailableCategories: {},
            datasetMaxStars: null,
            datasetMaxCitations: null,
            displayedPackages: [],
            totalFilteredCount: 0,

            // Actions
            setSearchTerm: debounce((searchTerm) => set({ searchTerm, currentPage: 1 }), 300),
            setSelectedTags: (selectedTags) => set({ selectedTags, currentPage: 1 }),
            addTag: (tag) => set((state) => ({
                selectedTags: state.selectedTags.includes(tag) ? state.selectedTags : [...state.selectedTags, tag],
                currentPage: 1
            })),
            setMinStars: (minStars) => set({ minStars: minStars !== null && !isNaN(minStars) && minStars >= 0 ? Number(minStars) : null, currentPage: 1 }),
            setHasGithub: (hasGithub) => set({ hasGithub, currentPage: 1 }),
            setHasWebserver: (hasWebserver) => set({ hasWebserver, currentPage: 1 }),
            setHasPublication: (hasPublication) => set({ hasPublication, currentPage: 1 }),
            setMinCitations: (minCitations) => set({ minCitations: minCitations !== null && !isNaN(minCitations) && minCitations >= 0 ? Number(minCitations) : null, currentPage: 1 }),
            setMinRating: (minRating) => set({ minRating: minRating !== null && !isNaN(minRating) && minRating >= 0 && minRating <= 5 ? Number(minRating) : null, currentPage: 1 }), // New rating filter action
            setFolder: (folder) => set({ folder, category: null, currentPage: 1 }),
            setCategory: (category) => set({ category, currentPage: 1 }),
            setSelectedLicenses: (selectedLicenses) => set({ selectedLicenses, currentPage: 1 }),
            setSort: (field, direction) => {
                const currentSortBy = get().sortBy;
                const currentSortDirection = get().sortDirection;
                if (field === null) {
                    set({ sortBy: initialStateValues.sortBy, sortDirection: initialStateValues.sortDirection, currentPage: 1 });
                } else if (direction) {
                    set({ sortBy: field, sortDirection: direction, currentPage: 1 });
                } else {
                    set({
                        sortBy: field,
                        sortDirection: field === currentSortBy && currentSortDirection === 'asc' ? 'desc' : 'asc',
                        currentPage: 1
                    });
                }
            },
            setDisplayedPackages: (displayedPackages) => set({ displayedPackages }),
            setTotalFilteredCount: (totalFilteredCount) => set({ totalFilteredCount }),
            setCurrentPage: (currentPage) => set({ currentPage }),
            setPageSize: (pageSize) => set({ pageSize, currentPage: 1 }), // Reset to first page when changing page size

			setOriginalPackagesAndDeriveMetadata: (packages: PackageWithNormalizedData[]) => {
				// This function is now deprecated but kept for compatibility
				// Metadata is now loaded separately via DataService
				set({ originalPackages: packages });
			},

            // Action to refresh metadata from server
            refreshMetadata: async () => {
                try {
                    const { DataService } = await import('../services/dataService');
                    await DataService.refreshFilterMetadata();
                } catch (error) {
                    console.error("❌ Error refreshing metadata:", error);
                    throw error;
                }
            },

            resetFilters: () => set((state) => ({
                // Reset filter criteria to their initial values
                searchTerm: initialStateValues.searchTerm,
                selectedTags: initialStateValues.selectedTags,
                minStars: initialStateValues.minStars,
                hasGithub: initialStateValues.hasGithub,
                hasWebserver: initialStateValues.hasWebserver,
                hasPublication: initialStateValues.hasPublication,
                minCitations: initialStateValues.minCitations,
                minRating: initialStateValues.minRating, // Reset rating filter
                folder: initialStateValues.folder,
                category: initialStateValues.category,
                selectedLicenses: initialStateValues.selectedLicenses,
                // sortBy and sortDirection are also part of initialStateValues
                sortBy: initialStateValues.sortBy,
                sortDirection: initialStateValues.sortDirection,
                currentPage: 1, // Reset current page
                pageSize: initialStateValues.pageSize, // Reset page size

                // Retain data that is fetched/derived once and doesn't change with filters
                originalPackages: state.originalPackages,
                allAvailableTags: state.allAvailableTags,
                allAvailableLicenses: state.allAvailableLicenses,
                allAvailableFolders: state.allAvailableFolders,
                allAvailableCategories: state.allAvailableCategories,
                datasetMaxStars: state.datasetMaxStars,
                datasetMaxCitations: state.datasetMaxCitations,
                
                // These are set by HomePage based on new (reset) filters, so clear them or let HomePage handle it
                displayedPackages: [], // Will be updated by HomePage after filters reset
                totalFilteredCount: 0, // Will be updated by HomePage
            })),
            setViewMode: (viewMode) => set({ viewMode }),
            toggleFilterSidebar: () => set((state) => ({ isFilterSidebarVisible: !state.isFilterSidebarVisible })),
            toggleNavSidebar: () => set((state) => ({ isNavSidebarVisible: !state.isNavSidebarVisible })),
        }),
        {
            name: 'cadd-vault-filter-storage-v4', // Incremented version for new rating filter
            partialize: (state) => ({
                searchTerm: state.searchTerm,
                selectedTags: state.selectedTags,
                minStars: state.minStars,
                hasGithub: state.hasGithub,
                hasWebserver: state.hasWebserver,
                hasPublication: state.hasPublication,
                minCitations: state.minCitations,
                minRating: state.minRating, // Include rating filter in persistence
                folder: state.folder,
                category: state.category,
                selectedLicenses: state.selectedLicenses,
                sortBy: state.sortBy,
                sortDirection: state.sortDirection,
                viewMode: state.viewMode,
                currentPage: state.currentPage,
                pageSize: state.pageSize,
                isFilterSidebarVisible: state.isFilterSidebarVisible,
                isNavSidebarVisible: state.isNavSidebarVisible,
            }),
        }
    )
);