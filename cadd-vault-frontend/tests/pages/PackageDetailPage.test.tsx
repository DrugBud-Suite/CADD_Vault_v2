/**
 * Tests for PackageDetailPage — loading state, error state, successful render,
 * admin controls visibility, delete flow, and edit navigation.
 *
 * Supabase is mocked with file-level vi.mock (adds rpc to the global mock).
 * useParams, useNavigate, and useAuth are mocked per-test as needed.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import PackageDetailPage from '../../src/pages/PackageDetailPage';
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
    },
  },
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// RatingInput renders nothing in tests to keep snapshots simple
vi.mock('../../src/components/RatingInput', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const theme = createTheme();

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <PackageDetailPage />
    </ThemeProvider>
  );

const makeChain = (resolveWith: { data?: any; error?: any } = {}) => {
  const result = { data: resolveWith.data ?? null, error: resolveWith.error ?? null };
  const chain: Record<string, any> = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'range', 'not', 'or'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
  return chain;
};

const mockPackage = {
  id: 'pkg-1',
  package_name: 'AwesomeTool',
  description: 'A great docking tool',
  license: 'MIT',
  github_stars: 1234,
  folder: 'Tools',
  category: 'Analysis',
  tags: ['ml', 'docking'],
  package_tags: [{ tags: { name: 'ml' } }, { tags: { name: 'docking' } }],
  package_folder_categories: [{
    folder_categories: {
      folders: { name: 'Tools' },
      categories: { name: 'Analysis' },
    },
  }],
};

const nonAdminAuth = {
  currentUser: { id: 'user-1', email: 'user@test.com' } as any,
  isAdmin: false,
  loading: false,
  session: null,
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  logout: vi.fn(),
};

const adminAuth = { ...nonAdminAuth, isAdmin: true };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useParams).mockReturnValue({ packageId: 'pkg-1' });
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
  vi.mocked(useAuth).mockReturnValue(nonAdminAuth);

  const chain = makeChain({ data: mockPackage });
  vi.mocked(supabase.from).mockReturnValue(chain as any);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('PackageDetailPage — loading state', () => {
  it('shows a circular progress spinner while fetching', () => {
    // Never resolves — stays in loading
    const neverChain: Record<string, any> = {};
    ['select', 'eq', 'single'].forEach(m => { neverChain[m] = vi.fn().mockReturnValue(neverChain); });
    neverChain.single = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    vi.mocked(supabase.from).mockReturnValue(neverChain as any);

    renderPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('PackageDetailPage — error state', () => {
  it('shows error message when fetch fails', async () => {
    const errChain = makeChain({ error: { message: 'Not found' } });
    vi.mocked(supabase.from).mockReturnValue(errChain as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch package data/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Successful render
// ---------------------------------------------------------------------------

describe('PackageDetailPage — successful render', () => {
  it('displays package name after fetch', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AwesomeTool')).toBeInTheDocument();
    });
  });

  it('displays package description', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('A great docking tool')).toBeInTheDocument();
    });
  });

  it('displays license', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('MIT')).toBeInTheDocument();
    });
  });

  it('shows tags as chips', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('ml')).toBeInTheDocument();
      expect(screen.getByText('docking')).toBeInTheDocument();
    });
  });

  it('shows "Package data is not available" when data is null', async () => {
    const nullChain = makeChain({ data: null });
    vi.mocked(supabase.from).mockReturnValue(nullChain as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/package data is not available/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Admin controls
// ---------------------------------------------------------------------------

describe('PackageDetailPage — rich package fields', () => {
  it('displays publication link when package has publication', async () => {
    const chain = makeChain({
      data: {
        ...mockPackage,
        publication: 'https://doi.org/10.1234/test',
        package_tags: [],
        package_folder_categories: [],
      },
    });
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/view publication/i).length).toBeGreaterThan(0);
    });
  });

  it('displays webserver link when package has webserver', async () => {
    const chain = makeChain({
      data: {
        ...mockPackage,
        webserver: 'https://mytool.example.com',
        package_tags: [],
        package_folder_categories: [],
      },
    });
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/visit webserver/i)).toBeInTheDocument();
    });
  });

  it('does not call rpc when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...nonAdminAuth, currentUser: null });

    renderPage();

    // Wait for the package to finish loading (data renders even without auth)
    await waitFor(() => screen.getByText('AwesomeTool'));
    // With no userId, rpc('get_user_rating') should not be called
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled();
  });

  it('displays github stars when package has github_stars', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('1234')).toBeInTheDocument();
    });
  });

  it('shows repository link when repo_link is provided', async () => {
    const chain = makeChain({
      data: {
        ...mockPackage,
        repo_link: 'https://github.com/owner/repo',
        package_tags: [],
        package_folder_categories: [],
      },
    });
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/view repository/i)).toBeInTheDocument();
    });
  });
});

describe('PackageDetailPage — admin controls', () => {
  it('shows Edit and Delete buttons for admin users', async () => {
    vi.mocked(useAuth).mockReturnValue(adminAuth);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  it('hides Edit and Delete buttons for non-admin users', async () => {
    renderPage();

    await waitFor(() => screen.getByText('AwesomeTool'));
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('navigates to edit page when Edit is clicked', async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useAuth).mockReturnValue(adminAuth);

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('edit-package'));
  });
});

// ---------------------------------------------------------------------------
// Delete flow
// ---------------------------------------------------------------------------

describe('PackageDetailPage — delete flow', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(adminAuth);
  });

  it('opens delete confirmation dialog when Delete is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
  });

  it('closes dialog when Cancel is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/confirm deletion/i)).not.toBeInTheDocument();
    });
  });

  it('calls supabase delete and navigates home after confirmation', async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const deleteChain = makeChain();
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'packages') return makeChain({ data: mockPackage }) as any;
      return deleteChain as any;
    });
    // Re-mock after setup so delete chain is used for delete call
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: mockPackage }) as any) // fetch
      .mockReturnValue(deleteChain as any); // delete

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/');
    });
  });
});
