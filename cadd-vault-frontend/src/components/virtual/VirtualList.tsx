import React, { CSSProperties } from 'react';
import { Box } from '@mui/material';
import { useVirtualization } from '../../hooks/useVirtualization';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode;
  height?: number | string;
  width?: number | string;
  estimateSize?: (index: number) => number;
  overscan?: number;
  className?: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  getItemKey?: (item: T, index: number) => string | number;
  EmptyComponent?: React.ComponentType;
  LoadingComponent?: React.ComponentType;
  isLoading?: boolean;
}

export function VirtualList<T>({
  items,
  renderItem,
  height = '100%',
  width = '100%',
  estimateSize,
  overscan = 5,
  className,
  onScroll,
  getItemKey,
  EmptyComponent,
  LoadingComponent,
  isLoading = false,
}: VirtualListProps<T>) {
  const {
    parentRef,
    virtualizer,
    virtualItems,
    totalSize,
  } = useVirtualization({
    items,
    estimateSize,
    overscan,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined,
  });

  // Handle loading state
  if (isLoading && LoadingComponent) {
    return <LoadingComponent />;
  }

  // Handle empty state
  if (!isLoading && items.length === 0 && EmptyComponent) {
    return <EmptyComponent />;
  }

  // Always use virtualization for consistent performance
  // (Removed fallback to non-virtualized rendering)

  return (
    <Box
      ref={parentRef}
      className={className}
      onScroll={onScroll}
      sx={{
        height,
        width,
        overflow: 'auto',
        contain: 'strict',
      }}
    >
      <Box
        sx={{
          height: totalSize,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <Box
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(
                item,
                virtualItem.index,
                {
                  height: `${virtualItem.size}px`,
                  width: '100%',
                }
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}