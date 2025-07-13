import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useCallback } from 'react';

export interface UseVirtualizationOptions<T> {
  items: T[];
  estimateSize?: (index: number) => number;
  overscan?: number;
  horizontal?: boolean;
  getItemKey?: (index: number) => string | number;
  paddingStart?: number;
  paddingEnd?: number;
  initialOffset?: number;
  scrollMargin?: number;
  lanes?: number;
  gap?: number;
}

export function useVirtualization<T>({
  items,
  estimateSize = () => 250,
  overscan = 5,
  horizontal = false,
  getItemKey,
  paddingStart = 0,
  paddingEnd = 0,
  initialOffset = 0,
  scrollMargin = 0,
  lanes = 1,
  gap = 0,
}: UseVirtualizationOptions<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    horizontal,
    paddingStart,
    paddingEnd,
    initialOffset,
    scrollMargin,
    lanes,
    gap,
    getItemKey: getItemKey || ((index) => index),
  });

  const scrollToIndex = useCallback(
    (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'smooth' | 'auto' }) => {
      virtualizer.scrollToIndex(index, options);
    },
    [virtualizer]
  );

  const measureItem = useCallback(
    (index: number) => {
      // This function is kept for compatibility but React Virtual
      // handles measuring automatically with the ref on virtual items
      console.debug('measureItem called for index:', index);
    },
    []
  );

  return {
    parentRef,
    virtualizer,
    scrollToIndex,
    measureItem,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}