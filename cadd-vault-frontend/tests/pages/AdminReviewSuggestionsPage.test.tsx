/**
 * Tests for AdminReviewSuggestionsPage — access control, data loading,
 * tab switching, approve/reject actions, and edit modal integration.
 *
 * All Supabase I/O is mocked so tests run without a database connection.
 * `ensureValidSession` is mocked to a no-op. The thenable chain pattern
 * lets `await supabase.from(...).select(...)` resolve correctly.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import AdminReviewSuggestionsPage from '../../src/pages/AdminReviewSuggestionsPage';
import { supabase } from '../../src/supabase';
import { useAuth } from '../../src/context/AuthContext';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  ensureValidSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// EditSuggestionModal is rendered as a child of this page and consumes
// React Query (useFilterMetadata + useQueryClient); stub both.
vi.mock('../../src/hooks/queries/useMetadata', () => {
  const data = {
    allAvailableTags: [] as string[],
    allAvailableLicenses: [] as string[],
    allAvailableFolders: [] as string[],
    allAvailableCategories: {} as Record<string, string[]>,
    datasetMaxStars: 0,
    datasetMaxCitations: 0,
    totalPackageCount: 0,
  };
  return {
    useFilterMetadata: () => ({ data, isLoading: false, error: null }),
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const theme = createTheme();

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <AdminReviewSuggestionsPage />
    </ThemeProvider>
  );

const makeChain = (resolveWith: { data?: any; error?: any; count?: number } = {}) => {
  const result = {
    data: resolveWith.data ?? null,
    error: resolveWith.error ?? null,
    count: resolveWith.count ?? 0,
  };
  const chain: Record<string, any> = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'range', 'single'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
  return chain;
};

const mockSuggestion = {
  id: 'sugg-1',
  package_name: 'AwesomeTool',
  description: 'Docking software',
  status: 'pending',
  created_at: '2024-01-15T10:00:00Z',
  user_email: 'user@example.com',
  tags: [],
  folder: '',
  category: '',
  license: 'MIT',
};

const adminAuthValue = {
  currentUser: { id: 'admin-1', email: 'admin@test.com' } as any,
  isAdmin: true,
  loading: false,
  session: null,
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  logout: vi.fn(),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
  const packagesChain = makeChain({ data: [] });
  vi.mocked(supabase.from).mockReturnValue(packagesChain as any);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
});

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

describe('AdminReviewSuggestionsPage — access control', () => {
  it('shows access denied alert for non-admin users', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...adminAuthValue,
      isAdmin: false,
      currentUser: { id: 'user-1' } as any,
    });

    renderPage();

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('does not fetch suggestions when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...adminAuthValue,
      isAdmin: false,
      currentUser: { id: 'user-1' } as any,
    });

    renderPage();

    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith(
      'get_suggestions_with_user_email',
      expect.anything()
    );
  });

  it('shows loading spinner while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({ ...adminAuthValue, loading: true });

    renderPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

describe('AdminReviewSuggestionsPage — data loading', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(adminAuthValue);
  });

  it('fetches suggestions with status "pending" on initial mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith(
        'get_suggestions_with_user_email',
        { filter_status: 'pending' }
      );
    });
  });

  it('displays package name in table after successful fetch', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [mockSuggestion],
      error: null,
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AwesomeTool')).toBeInTheDocument();
    });
  });

  it('shows empty state message when no suggestions exist', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no pending suggestions found/i)).toBeInTheDocument();
    });
  });

  it('shows error alert when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Server error', code: '500' },
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows user email in suggestions table', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [mockSuggestion],
      error: null,
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

describe('AdminReviewSuggestionsPage — tab navigation', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(adminAuthValue);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
  });

  it('renders all four status tabs', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Added to DB')).toBeInTheDocument();
    });
  });

  it('fetches with "approved" status when Approved tab is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Approved'));
    fireEvent.click(screen.getByText('Approved'));

    await waitFor(() => {
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith(
        'get_suggestions_with_user_email',
        { filter_status: 'approved' }
      );
    });
  });

  it('fetches with "rejected" status when Rejected tab is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Rejected'));
    fireEvent.click(screen.getByText('Rejected'));

    await waitFor(() => {
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith(
        'get_suggestions_with_user_email',
        { filter_status: 'rejected' }
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Suggestion actions
// ---------------------------------------------------------------------------

describe('AdminReviewSuggestionsPage — suggestion actions', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(adminAuthValue);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [mockSuggestion],
      error: null,
    } as any);
  });

  it('opens the edit modal when the edit icon button is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByText('AwesomeTool'));
    fireEvent.click(screen.getByTitle('Edit Suggestion'));

    expect(screen.getByText('Edit Suggestion')).toBeInTheDocument();
  });

  it('opens the reject dialog when the reject icon button is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByText('AwesomeTool'));
    fireEvent.click(screen.getByTitle('Reject'));

    await waitFor(() => {
      expect(screen.getByText(/reject suggestion/i)).toBeInTheDocument();
    });
  });

  it('approve action calls update with status "approved"', async () => {
    const updateChain = makeChain();
    vi.mocked(supabase.from).mockReturnValue(updateChain as any);

    renderPage();

    await waitFor(() => screen.getByTitle('Approve'));
    fireEvent.click(screen.getByTitle('Approve'));

    await waitFor(() => {
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Batch selection
// ---------------------------------------------------------------------------

describe('AdminReviewSuggestionsPage — batch operations', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(adminAuthValue);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [mockSuggestion],
      error: null,
    } as any);
  });

  it('shows batch action controls when suggestions are present', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/select all/i)).toBeInTheDocument();
    });
  });

  it('selecting a suggestion checkbox shows batch action buttons', async () => {
    renderPage();

    await waitFor(() => screen.getByText('AwesomeTool'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/approve \(1\)/i)).toBeInTheDocument();
    });
  });
});
