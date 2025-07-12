import React from 'react';
import { Tooltip, Box, Typography, Rating } from '@mui/material';
import { PackageWithNormalizedData } from '../types';
import { FiStar } from 'react-icons/fi';

interface PackageSummaryProps {
	selectedPackage: PackageWithNormalizedData | null;
}

const PackageSummary: React.FC<PackageSummaryProps> = ({ selectedPackage }) => {
	if (!selectedPackage) {
		return <div>Select a package to view details.</div>;
	}

	return (
		<div className='package-summary'>
			<h2>{selectedPackage.package_name}</h2> {/* Use package_name */}

			{/* Rating Info */}
			{(selectedPackage.average_rating !== undefined && selectedPackage.average_rating > 0) || (selectedPackage.ratings_count !== undefined && selectedPackage.ratings_count > 0) ? (
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
					{selectedPackage.average_rating !== undefined && selectedPackage.average_rating > 0 && (
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
							<Rating value={selectedPackage.average_rating} precision={0.1} readOnly size="small" />
							<Typography variant="body2" color="text.secondary">
								({selectedPackage.average_rating.toFixed(1)})
							</Typography>
						</Box>
					)}
					{selectedPackage.ratings_count !== undefined && selectedPackage.ratings_count > 0 && (
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
							<FiStar size={16} />
							<Typography variant="body2">{selectedPackage.ratings_count} ratings</Typography>
						</Box>
					)}
				</Box>
			) : null}

			<Tooltip title={selectedPackage.description}>
				<Box>
					<Typography variant="body1" sx={{ mb: 2 }}>{selectedPackage.description}</Typography> {/* Use Typography */}
				</Box>
			</Tooltip>
			<Typography variant="body2"><strong>Version:</strong> {selectedPackage.version}</Typography> {/* Use Typography */}
			<Typography variant="body2"><strong>License:</strong> {selectedPackage.license}</Typography> {/* Use Typography */}
			<Typography variant="body2"><strong>Repository:</strong> {selectedPackage.repository}</Typography> {/* Use Typography */}
		</div>
	);
};

export default PackageSummary;