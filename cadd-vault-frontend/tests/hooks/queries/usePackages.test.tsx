/**
 * Tests for usePackages hooks — usePackages, useInfinitePackages, usePackage,
 * useCreatePackage, useUpdatePackage, useDeletePackage.
 *
 * Each test creates an isolated QueryClient with retry:false and staleTime:0
 * so queries resolve immediately. The packageApi module is mocked entirely.
 * react-hot-toast is mocked to a no-op.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePackages,
  useInfinitePackages,
  usePackage,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
} from '../../../src/hooks/queries/usePackages';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/react-query/api/packages', () => ({
  packageApi: {
    getPackages: vi.fn(),
    getPackageById: vi.fn(),
    createPackage: vi.fn(),
    updatePackage: vi.fn(),
    deletePackage: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { packageApi } from '../../../src/lib/react-query/api/packages';

const mockPackage = {
  id: 'pkg-1',
  package_name: 'TestPackage',
  description: 'A test package',
  tags: ['ml'],
  folder: 'Tools',
  category: 'Analysis',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// usePackages
// ---------------------------------------------------------------------------

describe('usePackages', () => {
  it('returns data from packageApi.getPackages', async () => {
    const response = { packages: [mockPackage], totalCount: 1 };
    vi.mocked(packageApi.getPackages).mockResolvedValue(response as any);

    const { result } = renderHook(() => usePackages(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.packages).toHaveLength(1);
    expect(result.current.data?.totalCount).toBe(1);
  });

  it('passes filters to packageApi.getPackages', async () => {
    vi.mocked(packageApi.getPackages).mockResolvedValue({ packages: [], totalCount: 0 } as any);

    const filters = { searchTerm: 'docking', minStars: 100 };
    renderHook(() => usePackages(filters), { wrapper: createWrapper() });

    await waitFor(() => expect(vi.mocked(packageApi.getPackages)).toHaveBeenCalledWith(filters));
  });

  it('enters error state when API fails', async () => {
    vi.mocked(packageApi.getPackages).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePackages(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useInfinitePackages
// ---------------------------------------------------------------------------

describe('useInfinitePackages', () => {
  it('returns first page from packageApi.getPackages', async () => {
    vi.mocked(packageApi.getPackages).mockResolvedValue({
      packages: [mockPackage],
      totalCount: 2,
    } as any);

    const { result } = renderHook(() => useInfinitePackages(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].packages).toHaveLength(1);
  });

  it('getNextPageParam returns next page number when more results exist', async () => {
    vi.mocked(packageApi.getPackages).mockResolvedValue({
      packages: [mockPackage],
      totalCount: 5,
    } as any);

    const { result } = renderHook(() => useInfinitePackages(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('getNextPageParam returns undefined when all results loaded', async () => {
    vi.mocked(packageApi.getPackages).mockResolvedValue({
      packages: [mockPackage],
      totalCount: 1,
    } as any);

    const { result } = renderHook(() => useInfinitePackages(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('calls getPackages with page param from pageParam', async () => {
    vi.mocked(packageApi.getPackages).mockResolvedValue({
      packages: [],
      totalCount: 0,
    } as any);

    renderHook(() => useInfinitePackages({ searchTerm: 'test' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(vi.mocked(packageApi.getPackages)).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, searchTerm: 'test' })
      )
    );
  });
});

// ---------------------------------------------------------------------------
// usePackage
// ---------------------------------------------------------------------------

describe('usePackage', () => {
  it('fetches a single package by id', async () => {
    vi.mocked(packageApi.getPackageById).mockResolvedValue(mockPackage as any);

    const { result } = renderHook(() => usePackage('pkg-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.package_name).toBe('TestPackage');
  });

  it('is disabled when id is empty string', () => {
    const { result } = renderHook(() => usePackage(''), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(vi.mocked(packageApi.getPackageById)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useCreatePackage
// ---------------------------------------------------------------------------

describe('useCreatePackage', () => {
  it('calls packageApi.createPackage with the provided data', async () => {
    vi.mocked(packageApi.createPackage).mockResolvedValue(mockPackage as any);

    const { result } = renderHook(() => useCreatePackage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(mockPackage as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(packageApi.createPackage)).toHaveBeenCalledWith(mockPackage);
  });

  it('enters error state when createPackage fails', async () => {
    vi.mocked(packageApi.createPackage).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => useCreatePackage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(mockPackage as any);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useUpdatePackage
// ---------------------------------------------------------------------------

describe('useUpdatePackage', () => {
  it('calls packageApi.updatePackage with id and updates', async () => {
    vi.mocked(packageApi.updatePackage).mockResolvedValue({
      ...mockPackage,
      package_name: 'UpdatedPackage',
    } as any);

    const { result } = renderHook(() => useUpdatePackage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ id: 'pkg-1', updates: { package_name: 'UpdatedPackage' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(packageApi.updatePackage)).toHaveBeenCalledWith('pkg-1', {
      package_name: 'UpdatedPackage',
    });
  });

  it('enters error state when updatePackage fails', async () => {
    vi.mocked(packageApi.updatePackage).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useUpdatePackage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ id: 'pkg-1', updates: { package_name: 'X' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useDeletePackage
// ---------------------------------------------------------------------------

describe('useDeletePackage', () => {
  it('calls packageApi.deletePackage with the package id', async () => {
    vi.mocked(packageApi.deletePackage).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useDeletePackage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('pkg-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(packageApi.deletePackage)).toHaveBeenCalledWith('pkg-1');
  });

  it('enters error state when deletePackage fails', async () => {
    vi.mocked(packageApi.deletePackage).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useDeletePackage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('pkg-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
