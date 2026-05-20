import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BaseModal } from '../../../src/components/common/BaseModal';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);

describe('BaseModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title and content when open', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithTheme(<BaseModal {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays subtitle when provided', () => {
    renderWithTheme(<BaseModal {...defaultProps} subtitle="Test Subtitle" />);
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('accepts a ReactNode title', () => {
    const CustomTitle = <span data-testid="custom-title">Custom Title</span>;
    renderWithTheme(<BaseModal {...defaultProps} title={CustomTitle} />);
    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
  });

  it('displays loading spinner when loading', () => {
    renderWithTheme(<BaseModal {...defaultProps} loading />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error alert when error prop is set', () => {
    renderWithTheme(<BaseModal {...defaultProps} error="Test error message" />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-standardError');
  });

  it('displays success alert when success prop is set', () => {
    renderWithTheme(<BaseModal {...defaultProps} success="Test success message" />);
    expect(screen.getByText('Test success message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-standardSuccess');
  });

  it('renders custom actions in the footer', () => {
    const actions = <button data-testid="custom-action">OK</button>;
    renderWithTheme(<BaseModal {...defaultProps} actions={actions} />);
    expect(screen.getByTestId('custom-action')).toBeInTheDocument();
  });

  it('shows close button by default', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    expect(screen.getByLabelText('close')).toBeInTheDocument();
  });

  it('hides close button when showCloseButton=false', () => {
    renderWithTheme(<BaseModal {...defaultProps} showCloseButton={false} />);
    expect(screen.queryByLabelText('close')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderWithTheme(<BaseModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    renderWithTheme(<BaseModal {...defaultProps} onClose={onClose} />);
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does not call onClose on backdrop click when disableBackdropClick=true', async () => {
    const onClose = vi.fn();
    renderWithTheme(
      <BaseModal {...defaultProps} onClose={onClose} disableBackdropClick />
    );
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the close button while loading', () => {
    renderWithTheme(<BaseModal {...defaultProps} loading />);
    expect(screen.getByLabelText('close')).toBeDisabled();
  });

  it('exposes aria-labelledby on the dialog pointing at the title', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Test Modal');
  });

  it('shows both error and success alerts together when both are set', () => {
    renderWithTheme(
      <BaseModal {...defaultProps} error="Error message" success="Success message" />
    );
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders complex children including lists and paragraphs', () => {
    renderWithTheme(
      <BaseModal {...defaultProps}>
        <p>First paragraph</p>
        <p>Second paragraph</p>
        <ul>
          <li>List item 1</li>
          <li>List item 2</li>
        </ul>
      </BaseModal>
    );
    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph')).toBeInTheDocument();
    expect(screen.getByText('List item 1')).toBeInTheDocument();
    expect(screen.getByText('List item 2')).toBeInTheDocument();
  });
});
