import React, { useMemo, CSSProperties } from 'react';
import { Box } from '@mui/material';
import { useVirtualization } from '../../hooks/useVirtualization';
import { useResponsiveColumns } from '../../hooks/useResponsiveColumns';

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode;
  height?: number | string;
  width?: number | string;
  estimateSize?: (index: number) => number;
  gap?: number;
  overscan?: number;
  className?: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  getItemKey?: (item: T, index: number) => string | number;
  EmptyComponent?: React.ComponentType;
  LoadingComponent?: React.ComponentType;
  isLoading?: boolean;
  columnConfig?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export function VirtualGrid<T>({
  items,
  renderItem,
  height = '100%',
  width = '100%',
  estimateSize,
  gap = 16,
  overscan = 2,
  className,
  onScroll,
  getItemKey,
  EmptyComponent,
  LoadingComponent,
  isLoading = false,
  columnConfig,
}: VirtualGridProps<T>) {
  const { columns, estimateItemHeight } = useResponsiveColumns(columnConfig);

  // Calculate rows from items and columns
  const rows = useMemo(() => {
    const rowsArray = [];
    for (let i = 0; i < items.length; i += columns) {
      rowsArray.push(items.slice(i, i + columns));
    }
    return rowsArray;
  }, [items, columns]);

  const {
    parentRef,
    virtualizer,
    virtualItems,
    totalSize,
  } = useVirtualization({
    items: rows,
    estimateSize: estimateSize || (() => estimateItemHeight),
    overscan,
    gap,
    getItemKey: getItemKey ? (rowIndex) => {
      const firstItemIndex = rowIndex * columns;
      const firstItem = items[firstItemIndex];
      return firstItem ? getItemKey(firstItem, firstItemIndex) : rowIndex;
    } : undefined,
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
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <Box
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridAutoRows: '1fr', // Make all grid items in this row have equal height
                gap: `${gap}px`,
                padding: `0 ${gap}px`,
                minHeight: `${virtualRow.size}px`, // Ensure the row has a minimum height for virtualization
              }}
            >
              {row.map((item, colIndex) => {
                const itemIndex = virtualRow.index * columns + colIndex;
                const key = getItemKey ? getItemKey(item, itemIndex) : itemIndex;
                
                return (
                  <Box key={key} sx={{ 
                    height: '100%', 
                    width: '100%',
                    display: 'flex', // Ensure the card fills the entire grid cell
                    flexDirection: 'column'
                  }}>
                    {renderItem(
                      item,
                      itemIndex,
                      {
                        height: '100%',
                        width: '100%',
                      }
                    )}
                  </Box>
                );
              })}
              {/* Fill empty cells in last row */}
              {row.length < columns && 
                Array.from({ length: columns - row.length }).map((_, emptyIndex) => (
                  <Box 
                    key={`empty-${virtualRow.index}-${emptyIndex}`} 
                    sx={{ 
                      height: '100%', 
                      width: '100%' 
                    }} 
                  />
                ))
              }
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}