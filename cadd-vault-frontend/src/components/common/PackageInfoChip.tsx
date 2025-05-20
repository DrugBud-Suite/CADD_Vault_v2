// src/components/common/PackageInfoChip.tsx
import React from 'react';
import { Chip, Tooltip, SxProps, Theme } from '@mui/material';

interface PackageInfoChipProps {
	icon: React.ReactElement;
	label: string | number;
	tooltipTitle: string;
	iconColor?: string; // e.g., 'warning.main', 'info.main', 'success.main'
	variant?: 'card' | 'list'; // To handle slight style differences if necessary
}

const PackageInfoChip: React.FC<PackageInfoChipProps> = ({ icon, label, tooltipTitle, iconColor, variant = 'card' }) => {
	if (label === undefined || label === null || (typeof label === 'number' && label < 0)) { // Or specific conditions like stars > 0
		return null;
	}

	const chipStyle: SxProps<Theme> = {
		borderRadius: 4,
		'& .MuiChip-label': {
			px: 1,
			fontSize: '0.75rem',
		},
		'& .MuiChip-icon': {
			color: iconColor, // Use the prop for icon color
			...(variant === 'list' && { ml: '4px' }) // Specific style for list variant
		},
		...(variant === 'card' && { // Styles specific to PackageCard
			border: 'none',
			bgcolor: 'transparent',
			'& .MuiChip-label': {
				color: 'text.secondary'
			},
			'&:hover': {
				bgcolor: 'transparent' // Ensure no background change on hover for list item chips
			},
		}),
		...(variant === 'list' && { // Styles specific to PackageListItem
			border: 'none',
			bgcolor: 'transparent',
			'& .MuiChip-label': {
				color: 'text.secondary'
			},
			'&:hover': {
				bgcolor: 'transparent' // Ensure no background change on hover for list item chips
			},
		})
	};

	return (
		<Tooltip title={tooltipTitle} arrow>
			<Chip
				icon={icon}
				label={label.toString()}
				size="small"
				variant="outlined" // Base variant
				sx={chipStyle}
			/>
		</Tooltip >
	);
};

export default PackageInfoChip;