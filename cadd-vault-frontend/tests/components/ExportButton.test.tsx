/**
 * Tests for ExportButton — the tiered confirmation flow that guards CSV
 * export. useExportPackages is mocked so only the dialog logic is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const mockExportPackages = vi.hoisted(() => vi.fn());

vi.mock('../../src/hooks/useExportPackages', () => ({
  useExportPackages: () => ({ exportPackages: mockExportPackages, isExporting: false }),
  EXPORT_HARD_CAP: 10000,
  EXPORT_WARN_THRESHOLD: 1000,
}));

import ExportButton from '../../src/components/ExportButton';

const theme = createTheme();

const renderButton = (totalCount: number) =>
  render(
    <ThemeProvider theme={theme}>
      <ExportButton filters={{}} totalCount={totalCount} />
    </ThemeProvider>,
  );

const exportTrigger = () =>
  screen.getByRole('button', { name: /export filtered packages/i });

beforeEach(() => {
  mockExportPackages.mockClear();
});

describe('ExportButton', () => {
  it('is disabled when there are no packages to export', () => {
    renderButton(0);
    expect(exportTrigger()).toBeDisabled();
  });

  it('exports immediately for small result sets', () => {
    renderButton(50);
    fireEvent.click(exportTrigger());
    expect(mockExportPackages).toHaveBeenCalledOnce();
  });

  it('asks for confirmation above the warn threshold', () => {
    renderButton(5000);
    fireEvent.click(exportTrigger());
    // Not exported yet — a confirmation dialog is shown first.
    expect(mockExportPackages).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(mockExportPackages).toHaveBeenCalledOnce();
  });

  it('blocks export entirely above the hard cap', () => {
    renderButton(20000);
    fireEvent.click(exportTrigger());
    expect(mockExportPackages).not.toHaveBeenCalled();
    expect(screen.getByText(/too many results to export/i)).toBeInTheDocument();
  });
});
