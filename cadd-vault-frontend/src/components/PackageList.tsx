import React from 'react';
import { Box, Typography, List as MuiList } from '@mui/material';
import PackageListItem from './PackageListItem';
import { Package } from '../types';

interface PackageListProps {
	packages: Package[];
}

const PackageListComponent = ({ packages }: PackageListProps) => {
	if (packages.length === 0) {
		return (
			<Box sx={{ textAlign: 'center', mt: 4 }}>
				<Typography variant="h6" color="text.secondary">
					No packages found matching your criteria.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ width: '100%' }}>
			<MuiList sx={{ width: '100%' }}>
				{packages.map((pkg) => (
					<PackageListItem key={pkg.id} pkg={pkg} />
				))}
			</MuiList>
		</Box>
	);
};

export default React.memo(PackageListComponent);