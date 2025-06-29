// src/components/common/PackageLinkButton.tsx
import React from 'react';
import { Button, Tooltip, Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';

// The buttonStyle from PackageCard.tsx and PackageListItem.tsx
const buttonStyle = {
	borderRadius: 4,
	textTransform: 'none' as const,
	px: 1.5,
	minWidth: 'auto',
	borderColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.3),
	color: 'primary.main',
	position: 'relative' as const,
	transition: (theme: Theme) => theme.transitions.create(['all'], {
		duration: '0.2s'
	}),
	'&::before': {
		content: '""',
		position: 'absolute' as const,
		top: -1,
		left: -1,
		right: -1,
		bottom: -1,
		borderRadius: 4,
		padding: '1px',
		background: (theme: Theme) => theme.palette.mode === 'dark'
			? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0)}, ${alpha(theme.palette.primary.main, 0.3)})`
			: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0)}, ${alpha(theme.palette.primary.main, 0.2)})`,
		WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
		WebkitMaskComposite: 'xor' as const,
		maskComposite: 'exclude' as const,
	},
	'&:hover': {
		borderColor: 'primary.main',
		color: (theme: Theme) => theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
		bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.04),
		'&::before': {
			background: (theme: Theme) => theme.palette.mode === 'dark'
				? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.primary.main, 0.4)})`
				: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.primary.main, 0.3)})`,
		},
		transform: 'translateY(-1px)',
		boxShadow: (theme: Theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
	}
};

export interface PackageLinkButtonProps {
	href: string;
	icon: React.ReactNode;
	label: string;
	tooltipTitle?: string;
	variant?: 'outlined' | 'contained' | 'text';
	size?: 'small' | 'medium' | 'large';
	fullWidth?: boolean;
	className?: string;
	onClick?: (e: React.MouseEvent) => void;
}

const PackageLinkButton: React.FC<PackageLinkButtonProps> = ({ 
	href, 
	icon, 
	label, 
	tooltipTitle,
	variant = 'outlined',
	size = 'small',
	fullWidth = false,
	className,
	onClick
}) => {
	if (!href) return null;

	const handleClick = (e: React.MouseEvent) => {
		if (onClick) {
			onClick(e);
		}
	};

	const button = (
		<Button
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			variant={variant}
			size={size}
			fullWidth={fullWidth}
			startIcon={icon}
			sx={buttonStyle}
			className={className}
			aria-label={`${label} Link`}
			onClick={handleClick}
		>
			{label}
		</Button>
	);

	return tooltipTitle ? (
		<Tooltip title={tooltipTitle} arrow>
			{button}
		</Tooltip>
	) : (
		button
	);
};

export default PackageLinkButton;