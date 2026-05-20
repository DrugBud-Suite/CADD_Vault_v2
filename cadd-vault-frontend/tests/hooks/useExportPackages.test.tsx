/**
 * Tests for the useExportPackages hook — orchestrates fetch -> serialize ->
 * download with toast feedback. packageApi and the CSV download side-effect
 * are mocked; serialization runs for real (it is a pure function).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/lib/react-query/api/packages', () => ({
  packageApi: { getAllPackagesForExport: vi.fn() },
}));

vi.mock('../../src/utils/export/csvExport', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/export/csvExport')>(
    '../../src/utils/export/csvExport',
  );
  return { ...actual, triggerCsvDownload: vi.fn() };
});

vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { useExportPackages } from '../../src/hooks/useExportPackages';
import { packageApi } from '../../src/lib/react-query/api/packages';
import { triggerCsvDownload } from '../../src/utils/export/csvExport';
import { toast } from 'react-hot-toast';

const mockPkg = {
  id: 'p1',
  package_name: 'Pkg',
  description: 'desc',
  folder: 'Folder',
  category: 'Category',
  tags: ['t'],
  license: 'MIT',
};

const getAllMock = vi.mocked(packageApi.getAllPackagesForExport);
const downloadMock = vi.mocked(triggerCsvDownload);
const successMock = vi.mocked(toast.success);
const errorMock = vi.mocked(toast.error);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useExportPackages', () => {
  it('downloads a CSV and reports success', async () => {
    getAllMock.mockResolvedValue({ packages: [mockPkg], totalCount: 1, truncated: false });
    const { result } = renderHook(() => useExportPackages());

    await act(async () => {
      await result.current.exportPackages({});
    });

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(successMock).toHaveBeenCalledWith('Exported 1 packages', expect.anything());
    expect(result.current.isExporting).toBe(false);
  });

  it('warns when the export was truncated at the hard cap', async () => {
    getAllMock.mockResolvedValue({ packages: [mockPkg], totalCount: 25000, truncated: true });
    const { result } = renderHook(() => useExportPackages());

    await act(async () => {
      await result.current.exportPackages({});
    });

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(successMock).toHaveBeenCalledWith(
      expect.stringContaining('capped'),
      expect.anything(),
    );
  });

  it('shows an error and skips download when there are no packages', async () => {
    getAllMock.mockResolvedValue({ packages: [], totalCount: 0, truncated: false });
    const { result } = renderHook(() => useExportPackages());

    await act(async () => {
      await result.current.exportPackages({});
    });

    expect(downloadMock).not.toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalledWith('No packages to export', expect.anything());
  });

  it('reports an error and resets isExporting when the fetch fails', async () => {
    getAllMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useExportPackages());

    await act(async () => {
      await result.current.exportPackages({});
    });

    expect(downloadMock).not.toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('network down'),
      expect.anything(),
    );
    expect(result.current.isExporting).toBe(false);
  });
});
