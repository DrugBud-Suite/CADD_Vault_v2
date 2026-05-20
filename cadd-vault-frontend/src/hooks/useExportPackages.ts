import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { packageApi, PackageFilters } from '../lib/react-query/api/packages';
import { getErrorMessage } from '../utils/errorMessage';
import {
  serializePackagesToCsv,
  triggerCsvDownload,
  buildExportFilename,
} from '../utils/export/csvExport';

export const EXPORT_HARD_CAP = 10000;
export const EXPORT_WARN_THRESHOLD = 1000;

export interface UseExportPackagesResult {
  exportPackages: (filters: PackageFilters) => Promise<void>;
  isExporting: boolean;
}

export const useExportPackages = (): UseExportPackagesResult => {
  const [isExporting, setIsExporting] = useState(false);

  const exportPackages = useCallback(async (filters: PackageFilters) => {
    setIsExporting(true);
    const toastId = toast.loading('Preparing export...');
    try {
      const { packages, totalCount, truncated } = await packageApi.getAllPackagesForExport(
        filters,
        { hardCap: EXPORT_HARD_CAP }
      );

      if (packages.length === 0) {
        toast.error('No packages to export', { id: toastId });
        return;
      }

      const csv = serializePackagesToCsv(packages);
      triggerCsvDownload(csv, buildExportFilename());

      if (truncated) {
        toast.success(
          `Exported ${packages.length} of ${totalCount} packages (capped at ${EXPORT_HARD_CAP})`,
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.success(`Exported ${packages.length} packages`, { id: toastId });
      }
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(`Export failed: ${message}`, { id: toastId });
      console.error('CSV export failed', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportPackages, isExporting };
};
