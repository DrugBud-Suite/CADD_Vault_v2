/**
 * Tests for HomePage — loading states, error display, package count, empty state,
 * sort controls, sort direction toggle, and view mode switching.
 *
 * useInfinitePackages, useFilterMetadata, useFilterStore, useAuth, and
 * useQueryClient are all mocked. VirtualGrid, ExportButton, PackageList,
 * and PackageCard are mocked as lightweight stubs.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import HomePage from '../../src/pages/HomePage';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/hooks/queries/usePackages', () => ({
  useInfinitePackages: vi.fn(),
}));

vi.mock('../../src/hooks/queries/useMetadata', () => ({
  useFilterMetadata: vi.fn(),
}));

vi.mock('../../src/store/filterStore', () => {
  const defaultState = {
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
    sortDirection: 'asc' as const,
    viewMode: 'card' as const,
    setSort: vi.fn(),
    setViewMode: vi.fn(),
  };
  const useFilterStore = vi.fn((selector: any) =>
    typeof selector === 'function' ? selector(defaultState) : defaultState);
  (useFilterStore as any).setState = vi.fn();
  (useFilterStore as any).getState = () => defaultState;
  return { useFilterStore };
});

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    })),
  };
});

// Lightweight stub for VirtualGrid
vi.mock('../../src/components/virtual/VirtualGrid', () => ({
  VirtualGrid: ({ items, renderItem }: { items: any[]; renderItem: Function }) => (
    <div data-testid="virtual-grid">
      {items.map((item, i) => renderItem(item, i, {}))}
    </div>
  ),
}));

vi.mock('../../src/components/ExportButton', () => ({
  default: () => <button>Export</button>,
}));

// Stub lazy-loaded components
vi.mock('../../src/components/PackageCard', () => ({
  default: ({ pkg }: { pkg: any }) => <div data-testid="package-card">{pkg.package_name}</div>,
}));

vi.mock('../../src/components/PackageList', () => ({
  default: ({ packages }: { packages: any[] }) => (
    <div data-testid="package-list">
      {packages.map((p) => <div key={p.id}>{p.package_name}</div>)}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useInfinitePackages } from '../../src/hooks/queries/usePackages';
import { useFilterMetadata } from '../../src/hooks/queries/useMetadata';
import { useAuth } from '../../src/context/AuthContext';
import { useFilterStore } from '../../src/store/filterStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const theme = createTheme();

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <HomePage />
    </ThemeProvider>
  );

const mockPackage = {
  id: 'pkg-1',
  package_name: 'AwesomeTool',
  tags: [],
  folder: 'Tools',
  category: 'Analysis',
};

const defaultInfiniteData = {
  pages: [{ packages: [mockPackage], totalCount: 1 }],
  pageParams: [1],
};

const defaultMetadata = {
  allAvailableTags: ['ml'],
  allAvailableLicenses: ['MIT'],
  allAvailableFolders: ['Tools'],
  allAvailableCategories: { Tools: ['Analysis'] },
  datasetMaxStars: 5000,
  datasetMaxCitations: 1000,
};

const defaultPackagesHook = {
  data: defaultInfiniteData,
  isLoading: false,
  error: null,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

const defaultMetadataHook = {
  data: defaultMetadata,
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    currentUser: { id: 'user-1' } as any,
    isAdmin: false,
    loading: false,
    session: null,
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    logout: vi.fn(),
  });
  vi.mocked(useInfinitePackages).mockReturnValue(defaultPackagesHook as any);
  vi.mocked(useFilterMetadata).mockReturnValue(defaultMetadataHook as any);
});

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

describe('HomePage — loading states', () => {
  it('shows loading spinner during metadata load', () => {
    vi.mocked(useFilterMetadata).mockReturnValue({
      ...defaultMetadataHook,
      isLoading: true,
      data: undefined,
    } as any);

    renderPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getAllByText(/loading filter options/i).length).toBeGreaterThan(0);
  });

  it('shows "Loading packages..." during package load after metadata is ready', () => {
    vi.mocked(useInfinitePackages).mockReturnValue({
      ...defaultPackagesHook,
      isLoading: true,
      data: undefined,
    } as any);

    renderPage();

    expect(screen.getByText(/loading packages/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('HomePage — error state', () => {
  it('shows an error alert when packages query fails', () => {
    vi.mocked(useInfinitePackages).mockReturnValue({
      ...defaultPackagesHook,
      error: new Error('Failed to load'),
    } as any);

    renderPage();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Successful render
// ---------------------------------------------------------------------------

describe('HomePage — successful render', () => {
  it('displays total package count in heading', () => {
    renderPage();

    expect(screen.getByText(/1 entries found/i)).toBeInTheDocument();
  });

  it('renders packages via VirtualGrid in card view', () => {
    renderPage();

    expect(screen.getByTestId('virtual-grid')).toBeInTheDocument();
    expect(screen.getByTestId('package-card')).toBeInTheDocument();
  });

  it('shows empty state message when no packages match', () => {
    vi.mocked(useInfinitePackages).mockReturnValue({
      ...defaultPackagesHook,
      data: { pages: [{ packages: [], totalCount: 0 }], pageParams: [1] },
    } as any);

    renderPage();

    expect(screen.getByText(/no packages found/i)).toBeInTheDocument();
  });

  it('shows 0 Entries Found when data is empty', () => {
    vi.mocked(useInfinitePackages).mockReturnValue({
      ...defaultPackagesHook,
      data: { pages: [{ packages: [], totalCount: 0 }], pageParams: [1] },
    } as any);

    renderPage();

    expect(screen.getByText(/0 entries found/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sort controls
// ---------------------------------------------------------------------------

describe('HomePage — sort controls', () => {
  it('renders the Sort by label', () => {
    renderPage();

    expect(screen.getByText('Sort by:')).toBeInTheDocument();
  });

  it('renders sort direction toggle button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /toggle sort direction/i })).toBeInTheDocument();
  });

  it('clicking sort direction toggle calls setSort', () => {
    const setSort = vi.fn();
    (useFilterStore as any).mockImplementation((selector: any) => {
      const state = {
        searchTerm: '', selectedTags: [], minStars: null, hasGithub: false,
        hasWebserver: false, hasPublication: false, minCitations: null, minRating: null,
        folder: null, category: null, selectedLicenses: [], sortBy: 'package_name',
        sortDirection: 'asc' as const, viewMode: 'card' as const,
        setSort, setViewMode: vi.fn(),
      };
      return typeof selector === 'function' ? selector(state) : state;
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /toggle sort direction/i }));
    expect(setSort).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// View mode
// ---------------------------------------------------------------------------

describe('HomePage — view mode', () => {
  it('renders card view toggle button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /card view/i })).toBeInTheDocument();
  });

  it('renders list view toggle button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument();
  });

  it('renders PackageList when viewMode is list', async () => {
    (useFilterStore as any).mockImplementation((selector: any) => {
      const state = {
        searchTerm: '', selectedTags: [], minStars: null, hasGithub: false,
        hasWebserver: false, hasPublication: false, minCitations: null, minRating: null,
        folder: null, category: null, selectedLicenses: [], sortBy: 'package_name',
        sortDirection: 'asc' as const, viewMode: 'list' as const,
        setSort: vi.fn(), setViewMode: vi.fn(),
      };
      return typeof selector === 'function' ? selector(state) : state;
    });

    renderPage();

    // PackageList is React.lazy() — wait for Suspense to resolve
    await waitFor(() => {
      expect(screen.getByTestId('package-list')).toBeInTheDocument();
    });
  });
});
