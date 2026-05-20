import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PackageLinkButton from '../../../src/components/common/PackageLinkButton';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);

describe('PackageLinkButton', () => {
  const defaultProps = {
    href: 'https://example.com',
    icon: <span data-testid="test-icon">📦</span>,
    label: 'Test Link',
  };

  beforeEach(() => {
    // no-op; component delegates to anchor navigation, nothing to spy on
  });

  it('renders nothing when href is empty', () => {
    const { container } = renderWithTheme(
      <PackageLinkButton {...defaultProps} href="" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders as an anchor with href, target=_blank and rel=noopener noreferrer', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    const link = screen.getByRole('link', { name: /Test Link/ });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the supplied icon and label text', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Test Link')).toBeInTheDocument();
  });

  it('exposes an aria-label derived from the label prop', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Test Link Link');
  });

  it('applies the requested MUI size class', () => {
    const { rerender } = renderWithTheme(
      <PackageLinkButton {...defaultProps} size="small" />
    );
    expect(screen.getByRole('link')).toHaveClass('MuiButton-sizeSmall');

    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} size="medium" />
      </ThemeProvider>
    );
    expect(screen.getByRole('link')).toHaveClass('MuiButton-sizeMedium');

    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} size="large" />
      </ThemeProvider>
    );
    expect(screen.getByRole('link')).toHaveClass('MuiButton-sizeLarge');
  });

  it('applies the requested MUI variant class', () => {
    const { rerender } = renderWithTheme(
      <PackageLinkButton {...defaultProps} variant="outlined" />
    );
    expect(screen.getByRole('link')).toHaveClass('MuiButton-outlined');

    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} variant="contained" />
      </ThemeProvider>
    );
    expect(screen.getByRole('link')).toHaveClass('MuiButton-contained');

    rerender(
      <ThemeProvider theme={theme}>
        <PackageLinkButton {...defaultProps} variant="text" />
      </ThemeProvider>
    );
    expect(screen.getByRole('link')).toHaveClass('MuiButton-text');
  });

  it('applies the custom className prop', () => {
    renderWithTheme(<PackageLinkButton {...defaultProps} className="custom-class" />);
    expect(screen.getByRole('link')).toHaveClass('custom-class');
  });

  it('invokes onClick handler when the anchor is clicked', () => {
    let clicked = 0;
    renderWithTheme(
      <PackageLinkButton
        {...defaultProps}
        onClick={(e) => {
          e.preventDefault();
          clicked += 1;
        }}
      />
    );
    screen.getByRole('link').click();
    expect(clicked).toBe(1);
  });

  it('handles various URL formats', () => {
    const urls = [
      'https://github.com/user/repo',
      'http://example.com',
      'https://subdomain.example.org/path?query=value',
      'https://docs.example.com/api/v1#section',
    ];
    for (const url of urls) {
      const { unmount } = renderWithTheme(
        <PackageLinkButton {...defaultProps} href={url} />
      );
      expect(screen.getByRole('link')).toHaveAttribute('href', url);
      unmount();
    }
  });
});
