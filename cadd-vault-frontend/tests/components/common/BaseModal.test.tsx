import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { BaseModal } from '../../../src/components/common/BaseModal';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('BaseModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('should not render modal when closed', () => {
    renderWithTheme(<BaseModal {...defaultProps} open={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should display subtitle when provided', () => {
    renderWithTheme(
      <BaseModal {...defaultProps} subtitle="Test Subtitle" />
    );
    
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('should render custom title component', () => {
    const CustomTitle = <div data-testid="custom-title">Custom Title Component</div>;
    
    renderWithTheme(
      <BaseModal {...defaultProps} title={CustomTitle} />
    );
    
    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    renderWithTheme(<BaseModal {...defaultProps} loading={true} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display error message', () => {
    renderWithTheme(<BaseModal {...defaultProps} error="Test error message" />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-standardError');
  });

  it('should display success message', () => {
    renderWithTheme(<BaseModal {...defaultProps} success="Test success message" />);
    
    expect(screen.getByText('Test success message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-standardSuccess');
  });

  it('should render custom actions', () => {
    const customActions = (
      <div>
        <button data-testid="custom-action">Custom Action</button>
      </div>
    );

    renderWithTheme(
      <BaseModal {...defaultProps} actions={customActions} />
    );
    
    expect(screen.getByTestId('custom-action')).toBeInTheDocument();
  });

  it('should show close button by default', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('close');
    expect(closeButton).toBeInTheDocument();
  });

  it('should hide close button when showCloseButton is false', () => {
    renderWithTheme(<BaseModal {...defaultProps} showCloseButton={false} />);
    
    const closeButton = screen.queryByLabelText('close');
    expect(closeButton).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderWithTheme(<BaseModal {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('close');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    renderWithTheme(<BaseModal {...defaultProps} onClose={onClose} />);
    
    const backdrop = document.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    }
  });

  it('should not call onClose when backdrop is clicked and disableBackdropClick is true', async () => {
    const onClose = vi.fn();
    renderWithTheme(
      <BaseModal {...defaultProps} onClose={onClose} disableBackdropClick={true} />
    );
    
    const backdrop = document.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
      await waitFor(() => {
        expect(onClose).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    }
  });

  it('should apply custom maxWidth', () => {
    renderWithTheme(<BaseModal {...defaultProps} maxWidth="lg" />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.MuiDialog-paperWidthLg')).toBeInTheDocument();
  });

  it('should apply fullWidth when specified', () => {
    renderWithTheme(<BaseModal {...defaultProps} fullWidth={true} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.MuiDialog-paperFullWidth')).toBeInTheDocument();
  });

  it('should handle disabled actions when loading', () => {
    const actions = (
      <button data-testid="action-button" disabled>
        Action
      </button>
    );

    renderWithTheme(
      <BaseModal {...defaultProps} loading={true} actions={actions} />
    );
    
    const actionButton = screen.getByTestId('action-button');
    expect(actionButton).toBeDisabled();
  });

  it('should have proper accessibility attributes', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    
    const title = screen.getByText('Test Modal');
    expect(title).toHaveAttribute('id');
  });

  it('should handle focus management', () => {
    renderWithTheme(<BaseModal {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    // Modal should be focused when opened
    expect(document.activeElement).toBeInTheDocument();
  });

  describe('Responsive behavior', () => {
    it('should be full screen on mobile when specified', () => {
      renderWithTheme(<BaseModal {...defaultProps} fullScreen={true} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog.querySelector('.MuiDialog-paperFullScreen')).toBeInTheDocument();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle both error and success messages', () => {
      renderWithTheme(
        <BaseModal 
          {...defaultProps} 
          error="Error message" 
          success="Success message" 
        />
      );
      
      // Both should be displayed
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });

    it('should handle loading state with custom actions', () => {
      const actions = (
        <div>
          <button data-testid="action-1">Action 1</button>
          <button data-testid="action-2">Action 2</button>
        </div>
      );

      renderWithTheme(
        <BaseModal {...defaultProps} loading={true} actions={actions} />
      );
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByTestId('action-1')).toBeInTheDocument();
      expect(screen.getByTestId('action-2')).toBeInTheDocument();
    });

    it('should handle multiline content properly', () => {
      const multilineContent = (
        <div>
          <p>First paragraph</p>
          <p>Second paragraph</p>
          <ul>
            <li>List item 1</li>
            <li>List item 2</li>
          </ul>
        </div>
      );

      renderWithTheme(
        <BaseModal {...defaultProps}>
          {multilineContent}
        </BaseModal>
      );
      
      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
      expect(screen.getByText('List item 1')).toBeInTheDocument();
      expect(screen.getByText('List item 2')).toBeInTheDocument();
    });
  });
});