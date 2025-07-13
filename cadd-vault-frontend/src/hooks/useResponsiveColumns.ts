import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useMemo } from 'react';

export interface UseResponsiveColumnsOptions {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export function useResponsiveColumns(options?: UseResponsiveColumnsOptions) {
  const theme = useTheme();
  
  // Default column configuration matching Material-UI Grid breakpoints used in HomePage
  const defaultOptions = useMemo(() => ({
    xs: 1,  // 1 column on extra small screens (0px+)
    sm: 2,  // 2 columns on small screens (600px+)
    md: 3,  // 3 columns on medium screens (900px+)
    lg: 4,  // 4 columns on large screens (1200px+)
    xl: 4,  // 4 columns on extra large screens (1536px+)
    ...options,
  }), [options]);

  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.down('md'));
  const isMd = useMediaQuery(theme.breakpoints.down('lg'));
  const isLg = useMediaQuery(theme.breakpoints.down('xl'));

  const columns = useMemo(() => {
    if (isXs) return defaultOptions.xs;
    if (isSm) return defaultOptions.sm;
    if (isMd) return defaultOptions.md;
    if (isLg) return defaultOptions.lg;
    return defaultOptions.xl;
  }, [isXs, isSm, isMd, isLg, defaultOptions]);

  // Calculate estimated item width based on viewport and columns
  const estimateItemWidth = useMemo(() => {
    if (typeof window === 'undefined') return 300; // SSR fallback
    
    const viewportWidth = window.innerWidth;
    const padding = 32; // Account for container padding
    const gap = 16; // Material-UI spacing={2} = 16px
    const totalGaps = (columns - 1) * gap;
    const availableWidth = viewportWidth - padding - totalGaps;
    
    return Math.floor(availableWidth / columns);
  }, [columns]);

  // Calculate estimated item height based on typical card content
  const estimateItemHeight = useMemo(() => {
    // Base heights vary by screen size to account for different content density
    const baseHeights = {
      1: 350, // Mobile: more vertical space for readability
      2: 320, // Tablet: balanced layout
      3: 300, // Desktop: compact but readable
      4: 280, // Large desktop: most compact
    };
    
    return baseHeights[columns as keyof typeof baseHeights] || 300;
  }, [columns]);

  return {
    columns,
    estimateItemWidth,
    estimateItemHeight,
    isXs,
    isSm,
    isMd,
    isLg,
  };
}