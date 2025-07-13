import React from 'react';
import { Box, Typography } from '@mui/material';
import PackageListItem from './PackageListItem';
import { VirtualList } from './virtual/VirtualList';
import { PackageWithNormalizedData } from '../types';

interface PackageListProps {
	packages: PackageWithNormalizedData[];
	height?: number | string;
	onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

const PackageListComponent = ({ 
	packages, 
	height = '100%',
	onScroll
}: PackageListProps) => {
	if (packages.length === 0) {
		return (
			<Box sx={{ textAlign: 'center', mt: 4 }}>
				<Typography variant="h6" color="text.secondary">
					No packages found matching your criteria.
				</Typography>
			</Box>
		);
	}

	// Render item function for virtualization
	const renderItem = (pkg: PackageWithNormalizedData, _index: number, style: React.CSSProperties) => (
		<Box key={pkg.id} style={style}>
			<PackageListItem pkg={pkg} />
		</Box>
	);

	// Always use virtualization for consistent performance
	return (
		<VirtualList
			items={packages}
			renderItem={renderItem}
			height={height}
			width="100%"
			estimateSize={() => 120} // Estimated height for PackageListItem
			overscan={5}
			getItemKey={(pkg) => pkg.id}
			onScroll={onScroll}
		/>
	);
};

export default React.memo(PackageListComponent);