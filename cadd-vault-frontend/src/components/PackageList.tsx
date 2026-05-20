import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import PackageListItem from './PackageListItem';
import { VirtualList } from './virtual/VirtualList';
import { PackageWithNormalizedData } from '../types';
import { buildRatingData } from '../lib/react-query/api/ratings';

interface PackageListProps {
	packages: PackageWithNormalizedData[];
	height?: number | string;
	onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
	userRatingsMap?: Map<string, { rating: number; rating_id: string }>;
}

const PackageListComponent = ({
	packages,
	height = '100%',
	onScroll,
	userRatingsMap,
}: PackageListProps) => {
	// Stable render function so React.memo on PackageListItem is preserved
	// across parent re-renders. Declared before any early return to satisfy
	// the rules of hooks.
	const renderItem = useCallback(
		(pkg: PackageWithNormalizedData, _index: number, style: React.CSSProperties) => (
			<Box key={pkg.id} style={style}>
				<PackageListItem pkg={pkg} preloadedRating={buildRatingData(pkg, userRatingsMap)} />
			</Box>
		),
		[userRatingsMap],
	);

	if (packages.length === 0) {
		return (
			<Box sx={{ textAlign: 'center', mt: 4 }}>
				<Typography variant="h6" color="text.secondary">
					No packages found matching your criteria.
				</Typography>
			</Box>
		);
	}

	// Use consistent height estimate based on standardized item height
	return (
		<VirtualList
			items={packages}
			renderItem={renderItem}
			height={height}
			width="100%"
			estimateSize={() => 140}
			overscan={5}
			getItemKey={(pkg) => pkg.id}
			onScroll={onScroll}
			gap={12}
		/>
	);
};

export default React.memo(PackageListComponent);
