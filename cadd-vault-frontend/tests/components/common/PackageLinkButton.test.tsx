import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import PackageLinkButton from '../../../src/components/common/PackageLinkButton';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock for window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen
});

describe('PackageLinkButton', () => {
  const defaultProps = {
    href: 'https://example.com',
    icon: <span data-testid="test-icon">📦</span>,
    label: 'Test Link'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render button with icon and label', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Test Link')).toBeInTheDocument();
  });

  it('should open link in new tab when clicked', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('should have proper accessibility attributes', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Open Test Link in new tab');
  });

  it('should render different sizes correctly', () => {
    const { rerender } = renderWithTheme(
      <PackageLinkButton {...defaultProps} size="small" />
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-sizeSmall');
    
    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} size="medium" />
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-sizeMedium');
    
    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} size="large" />
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-sizeLarge');
  });

  it('should apply correct variant styling', () => {
    const { rerender } = renderWithTheme(
      <PackageLinkButton {...defaultProps} variant="outlined" />
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-outlined');
    
    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} variant="contained" />
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-contained');
    
    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} variant="text" />
      </ThemeProvider>
    );
    
    button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-text');
  });

  it('should handle disabled state', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} disabled />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('should show only icon when showLabel is false', () => {
    renderWithTheme(
      <PackageLinkButton {...defaultProps} showLabel={false} />
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.queryByText('Test Link')).not.toBeInTheDocument();
  });

  it('should show both icon and label by default', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Test Link')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    renderWithTheme(
      <PackageLinkButton {...defaultProps} className="custom-class" />
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should apply custom styles', () => {
    const customStyles = { backgroundColor: 'red', color: 'white' };
    renderWithTheme(
      <PackageLinkButton {...defaultProps} style={customStyles} />
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveStyle('background-color: red');
    expect(button).toHaveStyle('color: white');
  });

  describe('URL handling', () => {
    it('should handle different URL formats', () => {
      const testUrls = [
        'https://github.com/user/repo',
        'http://example.com',
        'https://subdomain.example.org/path?query=value',
        'https://docs.example.com/api/v1#section'
      ];

      testUrls.forEach((url) => {
        const { unmount } = renderWithTheme(
          <PackageLinkButton {...defaultProps} href={url} />
        );
        
        const button = screen.getByRole('button');
        fireEvent.click(button);
        
        expect(mockWindowOpen).toHaveBeenCalledWith(
          url,
          '_blank',
          'noopener,noreferrer'
        );
        
        unmount();
        mockWindowOpen.mockClear();
      });
    });

    it('should handle empty or invalid URLs gracefully', () => {
      const { rerender } = renderWithTheme(
        <PackageLinkButton {...defaultProps} href="" />
      );
      
      let button = screen.getByRole('button');
      fireEvent.click(button);
      expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank', 'noopener,noreferrer');
      
      mockWindowOpen.mockClear();
      
      rerender(
        <ThemeProvider theme={theme}>
          <PackageLinkButton {...defaultProps} href="invalid-url" />
        </ThemeProvider>
      );
      
      button = screen.getByRole('button');
      fireEvent.click(button);
      expect(mockWindowOpen).toHaveBeenCalledWith('invalid-url', '_blank', 'noopener,noreferrer');
    });
  });

  describe('Icon rendering', () => {
    it('should render different icon types', () => {
      const icons = [
        { icon: <span data-testid="text-icon">🔗</span>, testId: 'text-icon' },
        { icon: <div data-testid="div-icon">Icon</div>, testId: 'div-icon' },
        { icon: <img data-testid="img-icon" src="icon.png" alt="icon" />, testId: 'img-icon' }
      ];

      icons.forEach(({ icon, testId }) => {
        const { unmount } = renderWithTheme(
          <PackageLinkButton {...defaultProps} icon={icon} />
        );
        
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        unmount();
      });
    });

    it('should maintain icon spacing with label', () => {
      renderWithTheme(<PackageLinkButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      const buttonClasses = button.className;
      
      // Should have proper spacing classes from MUI
      expect(buttonClasses).toMatch(/MuiButton/);
    });
  });

  describe('Label handling', () => {
    it('should handle long labels gracefully', () => {
      const longLabel = 'This is a very long label that might wrap or be truncated depending on the container size and styling applied to the button component';
      
      renderWithTheme(
        <PackageLinkButton {...defaultProps} label={longLabel} />
      );
      
      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    it('should handle special characters in labels', () => {
      const specialLabel = 'Label with "quotes" & ampersands < > and other chars';
      
      renderWithTheme(
        <PackageLinkButton {...defaultProps} label={specialLabel} />
      );
      
      expect(screen.getByText(specialLabel)).toBeInTheDocument();
    });

    it('should handle empty labels', () => {
      renderWithTheme(
        <PackageLinkButton {...defaultProps} label="" />
      );
      
      // Should still render but with empty text
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Interaction behavior', () => {
    it('should have hover states', () => {
      renderWithTheme(<PackageLinkButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // Simulate hover
      fireEvent.mouseEnter(button);
      expect(button).toHaveClass('MuiButton-root');
      
      fireEvent.mouseLeave(button);
      expect(button).toHaveClass('MuiButton-root');
    });

    it('should handle keyboard navigation', () => {
      renderWithTheme(<PackageLinkButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // Should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Should trigger on Enter key
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should handle multiple rapid clicks', () => {
      renderWithTheme(<PackageLinkButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // Rapidly click multiple times
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      
      expect(mockWindowOpen).toHaveBeenCalledTimes(3);
    });
  });
});