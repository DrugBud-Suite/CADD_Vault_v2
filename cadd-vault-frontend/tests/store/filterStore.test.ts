/**
 * Tests for filterStore — Zustand store actions, pagination, sort toggle,
 * validation guards, and resetFilters.
 *
 * The store uses `persist` middleware (localStorage) — jsdom provides this
 * automatically in the test environment. The `debounce` from lodash-es is
 * replaced with an identity function so setSearchTerm is synchronous.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFilterStore } from '../../src/store/filterStore';

// Make setSearchTerm synchronous so we can test it without fake timers
vi.mock('lodash-es', () => ({
  debounce: (fn: Function) => fn,
}));

function resetStore() {
  useFilterStore.setState({
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
    pageSize: 100,
    isFilterSidebarVisible: true,
    isNavSidebarVisible: true,
  });
}

// ---------------------------------------------------------------------------
// Filter actions
// ---------------------------------------------------------------------------

describe('filterStore — setSearchTerm', () => {
  beforeEach(resetStore);

  it('updates searchTerm', () => {
    useFilterStore.getState().setSearchTerm('docking');
    expect(useFilterStore.getState().searchTerm).toBe('docking');
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(5);
    useFilterStore.getState().setSearchTerm('test');
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

describe('filterStore — setSelectedTags', () => {
  beforeEach(resetStore);

  it('updates selectedTags', () => {
    useFilterStore.getState().setSelectedTags(['ml', 'docking']);
    expect(useFilterStore.getState().selectedTags).toEqual(['ml', 'docking']);
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(3);
    useFilterStore.getState().setSelectedTags(['ml']);
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

describe('filterStore — addTag', () => {
  beforeEach(resetStore);

  it('adds a new tag', () => {
    useFilterStore.getState().addTag('ml');
    expect(useFilterStore.getState().selectedTags).toContain('ml');
  });

  it('deduplicates tags', () => {
    useFilterStore.getState().addTag('ml');
    useFilterStore.getState().addTag('ml');
    expect(useFilterStore.getState().selectedTags).toHaveLength(1);
  });

  it('accumulates distinct tags', () => {
    useFilterStore.getState().addTag('ml');
    useFilterStore.getState().addTag('docking');
    expect(useFilterStore.getState().selectedTags).toEqual(['ml', 'docking']);
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(4);
    useFilterStore.getState().addTag('ml');
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

describe('filterStore — setMinStars', () => {
  beforeEach(resetStore);

  it('accepts valid positive number', () => {
    useFilterStore.getState().setMinStars(100);
    expect(useFilterStore.getState().minStars).toBe(100);
  });

  it('accepts zero', () => {
    useFilterStore.getState().setMinStars(0);
    expect(useFilterStore.getState().minStars).toBe(0);
  });

  it('rejects negative number (sets null)', () => {
    useFilterStore.getState().setMinStars(-1);
    expect(useFilterStore.getState().minStars).toBeNull();
  });

  it('sets null explicitly', () => {
    useFilterStore.getState().setMinStars(100);
    useFilterStore.getState().setMinStars(null);
    expect(useFilterStore.getState().minStars).toBeNull();
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(5);
    useFilterStore.getState().setMinStars(50);
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

describe('filterStore — boolean filters', () => {
  beforeEach(resetStore);

  it('setHasGithub updates flag and resets page', () => {
    useFilterStore.getState().setCurrentPage(3);
    useFilterStore.getState().setHasGithub(true);
    expect(useFilterStore.getState().hasGithub).toBe(true);
    expect(useFilterStore.getState().currentPage).toBe(1);
  });

  it('setHasWebserver updates flag', () => {
    useFilterStore.getState().setHasWebserver(true);
    expect(useFilterStore.getState().hasWebserver).toBe(true);
  });

  it('setHasPublication updates flag', () => {
    useFilterStore.getState().setHasPublication(true);
    expect(useFilterStore.getState().hasPublication).toBe(true);
  });
});

describe('filterStore — setMinCitations', () => {
  beforeEach(resetStore);

  it('accepts valid positive number', () => {
    useFilterStore.getState().setMinCitations(50);
    expect(useFilterStore.getState().minCitations).toBe(50);
  });

  it('rejects negative values', () => {
    useFilterStore.getState().setMinCitations(-5);
    expect(useFilterStore.getState().minCitations).toBeNull();
  });
});

describe('filterStore — setMinRating', () => {
  beforeEach(resetStore);

  it('accepts 0', () => {
    useFilterStore.getState().setMinRating(0);
    expect(useFilterStore.getState().minRating).toBe(0);
  });

  it('accepts 5', () => {
    useFilterStore.getState().setMinRating(5);
    expect(useFilterStore.getState().minRating).toBe(5);
  });

  it('accepts mid-range value', () => {
    useFilterStore.getState().setMinRating(3);
    expect(useFilterStore.getState().minRating).toBe(3);
  });

  it('rejects values greater than 5', () => {
    useFilterStore.getState().setMinRating(6);
    expect(useFilterStore.getState().minRating).toBeNull();
  });

  it('rejects negative values', () => {
    useFilterStore.getState().setMinRating(-1);
    expect(useFilterStore.getState().minRating).toBeNull();
  });
});

describe('filterStore — setFolder', () => {
  beforeEach(resetStore);

  it('updates folder', () => {
    useFilterStore.getState().setFolder('Tools');
    expect(useFilterStore.getState().folder).toBe('Tools');
  });

  it('clears category when folder changes', () => {
    useFilterStore.getState().setCategory('Analysis');
    useFilterStore.getState().setFolder('Tools');
    expect(useFilterStore.getState().category).toBeNull();
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(3);
    useFilterStore.getState().setFolder('Tools');
    expect(useFilterStore.getState().currentPage).toBe(1);
  });

  it('accepts null to clear folder', () => {
    useFilterStore.getState().setFolder('Tools');
    useFilterStore.getState().setFolder(null);
    expect(useFilterStore.getState().folder).toBeNull();
  });
});

describe('filterStore — setCategory', () => {
  beforeEach(resetStore);

  it('updates category', () => {
    useFilterStore.getState().setCategory('Visualization');
    expect(useFilterStore.getState().category).toBe('Visualization');
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(4);
    useFilterStore.getState().setCategory('Analysis');
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

describe('filterStore — setSelectedLicenses', () => {
  beforeEach(resetStore);

  it('updates licenses and resets page', () => {
    useFilterStore.getState().setCurrentPage(4);
    useFilterStore.getState().setSelectedLicenses(['MIT', 'Apache-2.0']);
    expect(useFilterStore.getState().selectedLicenses).toEqual(['MIT', 'Apache-2.0']);
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Sort actions
// ---------------------------------------------------------------------------

describe('filterStore — setSort', () => {
  beforeEach(resetStore);

  it('sets new sort field with asc direction', () => {
    useFilterStore.getState().setSort('github_stars');
    expect(useFilterStore.getState().sortBy).toBe('github_stars');
    expect(useFilterStore.getState().sortDirection).toBe('asc');
  });

  it('toggles direction to desc when same field already asc', () => {
    useFilterStore.setState({ sortBy: 'github_stars', sortDirection: 'asc' });
    useFilterStore.getState().setSort('github_stars');
    expect(useFilterStore.getState().sortDirection).toBe('desc');
  });

  it('toggles direction to asc when same field already desc', () => {
    useFilterStore.setState({ sortBy: 'github_stars', sortDirection: 'desc' });
    useFilterStore.getState().setSort('github_stars');
    expect(useFilterStore.getState().sortDirection).toBe('asc');
  });

  it('uses explicit direction when provided', () => {
    useFilterStore.getState().setSort('citations', 'desc');
    expect(useFilterStore.getState().sortBy).toBe('citations');
    expect(useFilterStore.getState().sortDirection).toBe('desc');
  });

  it('resets to defaults when field is null', () => {
    useFilterStore.setState({ sortBy: 'citations', sortDirection: 'desc' });
    useFilterStore.getState().setSort(null);
    expect(useFilterStore.getState().sortBy).toBe('package_name');
    expect(useFilterStore.getState().sortDirection).toBe('asc');
  });

  it('resets currentPage to 1', () => {
    useFilterStore.getState().setCurrentPage(3);
    useFilterStore.getState().setSort('citations');
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pagination actions
// ---------------------------------------------------------------------------

describe('filterStore — pagination', () => {
  beforeEach(resetStore);

  it('setCurrentPage updates page', () => {
    useFilterStore.getState().setCurrentPage(7);
    expect(useFilterStore.getState().currentPage).toBe(7);
  });

  it('setPageSize updates pageSize and resets to page 1', () => {
    useFilterStore.getState().setCurrentPage(3);
    useFilterStore.getState().setPageSize(50);
    expect(useFilterStore.getState().pageSize).toBe(50);
    expect(useFilterStore.getState().currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

describe('filterStore — UI state', () => {
  beforeEach(resetStore);

  it('setViewMode switches to list', () => {
    useFilterStore.getState().setViewMode('list');
    expect(useFilterStore.getState().viewMode).toBe('list');
  });

  it('setViewMode switches back to card', () => {
    useFilterStore.getState().setViewMode('list');
    useFilterStore.getState().setViewMode('card');
    expect(useFilterStore.getState().viewMode).toBe('card');
  });

  it('toggleFilterSidebar toggles visibility', () => {
    expect(useFilterStore.getState().isFilterSidebarVisible).toBe(true);
    useFilterStore.getState().toggleFilterSidebar();
    expect(useFilterStore.getState().isFilterSidebarVisible).toBe(false);
    useFilterStore.getState().toggleFilterSidebar();
    expect(useFilterStore.getState().isFilterSidebarVisible).toBe(true);
  });

  it('toggleNavSidebar toggles visibility', () => {
    expect(useFilterStore.getState().isNavSidebarVisible).toBe(true);
    useFilterStore.getState().toggleNavSidebar();
    expect(useFilterStore.getState().isNavSidebarVisible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetFilters
// ---------------------------------------------------------------------------

describe('filterStore — resetFilters', () => {
  beforeEach(resetStore);

  it('resets all filter criteria to defaults', () => {
    useFilterStore.getState().setSelectedTags(['ml']);
    useFilterStore.getState().setHasGithub(true);
    useFilterStore.getState().setMinStars(100);
    useFilterStore.getState().setFolder('Tools');
    useFilterStore.getState().setCurrentPage(5);

    useFilterStore.getState().resetFilters();

    const s = useFilterStore.getState();
    expect(s.selectedTags).toEqual([]);
    expect(s.hasGithub).toBe(false);
    expect(s.minStars).toBeNull();
    expect(s.folder).toBeNull();
    expect(s.currentPage).toBe(1);
  });

  it('resets minRating', () => {
    useFilterStore.getState().setMinRating(4);
    useFilterStore.getState().resetFilters();
    expect(useFilterStore.getState().minRating).toBeNull();
  });

  it('resets sortBy and sortDirection to defaults', () => {
    useFilterStore.setState({ sortBy: 'citations', sortDirection: 'desc' });
    useFilterStore.getState().resetFilters();
    expect(useFilterStore.getState().sortBy).toBe('package_name');
    expect(useFilterStore.getState().sortDirection).toBe('asc');
  });
});

