import React, { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { PackageFilters } from '../lib/react-query/api/packages';
import {
  useExportPackages,
  EXPORT_HARD_CAP,
  EXPORT_WARN_THRESHOLD,
} from '../hooks/useExportPackages';

interface ExportButtonProps {
  filters: PackageFilters;
  totalCount: number;
}

const ExportButton: React.FC<ExportButtonProps> = ({ filters, totalCount }) => {
  const { exportPackages, isExporting } = useExportPackages();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [capDialogOpen, setCapDialogOpen] = useState(false);

  const disabled = totalCount === 0 || isExporting;
  const tooltipTitle =
    totalCount === 0
      ? 'No packages to export'
      : isExporting
        ? 'Export in progress...'
        : `Export ${totalCount} packages to CSV`;

  const handleClick = () => {
    if (totalCount > EXPORT_HARD_CAP) {
      setCapDialogOpen(true);
      return;
    }
    if (totalCount > EXPORT_WARN_THRESHOLD) {
      setConfirmOpen(true);
      return;
    }
    void exportPackages(filters);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    void exportPackages(filters);
  };

  const button = (
    <span>
      <Button
        variant="outlined"
        size="small"
        onClick={handleClick}
        disabled={disabled}
        startIcon={
          isExporting ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <FileDownloadIcon />
          )
        }
        sx={{ textTransform: 'none', borderRadius: 2 }}
        aria-label="Export filtered packages to CSV"
      >
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </Button>
    </span>
  );

  return (
    <>
      <Tooltip title={tooltipTitle} arrow>
        {button}
      </Tooltip>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="export-confirm-title"
      >
        <DialogTitle id="export-confirm-title">Export {totalCount} packages?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This may take a few seconds for large exports.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" autoFocus>
            Export
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={capDialogOpen}
        onClose={() => setCapDialogOpen(false)}
        aria-labelledby="export-cap-title"
      >
        <DialogTitle id="export-cap-title">Too many results to export</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current filters match {totalCount.toLocaleString()} packages. Please refine your
            filters to {EXPORT_HARD_CAP.toLocaleString()} or fewer before exporting.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCapDialogOpen(false)} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ExportButton;
