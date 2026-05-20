// src/store/filterStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { debounce } from 'lodash-es';

type ViewMode = 'card' | 'list';

// Interface for the state. The store holds filter criteria + UI state only;
// server-derived metadata (tags, folders, licenses, dataset stats) lives in
// React Query via useFilterMetadata().
export interface FilterState { // Exporting for use in components
    searchTerm: string;
    selectedTags: string[];
    minStars: number | null;
    hasGithub: boolean;
    hasWebserver: boolean;
    hasPublication: boolean;
    minCitations: number | null;
    minRating: number | null;
    folder: string | null;
    category: string | null;
    selectedLicenses: string[];
    sortBy: string | null;
    sortDirection: 'asc' | 'desc';

    currentPage: number;
    pageSize: number;

    viewMode: ViewMode;
    isFilterSidebarVisible: boolean;
    isNavSidebarVisible: boolean;

    // Actions
    setSearchTerm: (term: string) => void;
    setSelectedTags: (tags: string[]) => void;
    addTag: (tag: string) => void;
    setMinStars: (stars: number | null) => void;
    setHasGithub: (has: boolean) => void;
    setHasWebserver: (has: boolean) => void;
    setHasPublication: (has: boolean) => void;
    setMinCitations: (citations: number | null) => void;
    setMinRating: (rating: number | null) => void;
    setFolder: (folder: string | null) => void;
    setCategory: (category: string | null) => void;
    setSelectedLicenses: (licenses: string[]) => void;
    setSort: (field: string | null, direction?: 'asc' | 'desc') => void;

    setCurrentPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;

    resetFilters: () => void;
    setViewMode: (mode: ViewMode) => void;
    toggleFilterSidebar: () => void;
    toggleNavSidebar: () => void;
    setFilterSidebarVisible: (visible: boolean) => void;
    setNavSidebarVisible: (visible: boolean) => void;
}

// Initial static part of the state (values that don't depend on fetched data)
const initialStateValues: Omit<FilterState,
    'setSearchTerm' | 'setSelectedTags' | 'addTag' | 'setMinStars' | 'setHasGithub' |
    'setHasWebserver' | 'setHasPublication' | 'setMinCitations' | 'setMinRating' | 'setFolder' |
    'setCategory' | 'setSelectedLicenses' | 'setSort' | 'setCurrentPage' | 'setPageSize' |
    'resetFilters' | 'setViewMode' | 'toggleFilterSidebar' | 'toggleNavSidebar' |
    'setFilterSidebarVisible' | 'setNavSidebarVisible'
> = {
    searchTerm: '',
    selectedTags: [],
    minStars: null,
    hasGithub: false,
    hasWebserver: false,
    hasPublication: false,
    minCitations: null,
    minRating: null,
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
            ...initialStateValues,

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
            setMinRating: (minRating) => set({ minRating: minRating !== null && !isNaN(minRating) && minRating >= 0 && minRating <= 5 ? Number(minRating) : null, currentPage: 1 }),
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
            setCurrentPage: (currentPage) => set({ currentPage }),
            setPageSize: (pageSize) => set({ pageSize, currentPage: 1 }), // Reset to first page when changing page size

            resetFilters: () => set({
                searchTerm: initialStateValues.searchTerm,
                selectedTags: initialStateValues.selectedTags,
                minStars: initialStateValues.minStars,
                hasGithub: initialStateValues.hasGithub,
                hasWebserver: initialStateValues.hasWebserver,
                hasPublication: initialStateValues.hasPublication,
                minCitations: initialStateValues.minCitations,
                minRating: initialStateValues.minRating,
                folder: initialStateValues.folder,
                category: initialStateValues.category,
                selectedLicenses: initialStateValues.selectedLicenses,
                sortBy: initialStateValues.sortBy,
                sortDirection: initialStateValues.sortDirection,
                currentPage: 1,
                pageSize: initialStateValues.pageSize,
            }),
            setViewMode: (viewMode) => set({ viewMode }),
            toggleFilterSidebar: () => set((state) => ({ isFilterSidebarVisible: !state.isFilterSidebarVisible })),
            toggleNavSidebar: () => set((state) => ({ isNavSidebarVisible: !state.isNavSidebarVisible })),
            setFilterSidebarVisible: (isFilterSidebarVisible) => set({ isFilterSidebarVisible }),
            setNavSidebarVisible: (isNavSidebarVisible) => set({ isNavSidebarVisible }),
        }),
        {
            name: 'cadd-vault-filter-storage-v4',
            partialize: (state) => ({
                searchTerm: state.searchTerm,
                selectedTags: state.selectedTags,
                minStars: state.minStars,
                hasGithub: state.hasGithub,
                hasWebserver: state.hasWebserver,
                hasPublication: state.hasPublication,
                minCitations: state.minCitations,
                minRating: state.minRating,
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
