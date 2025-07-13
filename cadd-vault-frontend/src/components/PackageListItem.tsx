// src/components/PackageListItem.tsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
	ListItem,
	ListItemText,
	Typography,
	Link,
	Box,
	Stack,
	Tooltip,
	Chip,
	Theme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PackageWithNormalizedData } from '../types';
import { useFilterStore } from '../store/filterStore';
import RatingInput from './RatingInput';
import PackageActions from './common/PackageActions';
import PackageMetrics from './common/PackageMetrics';

interface PackageListItemProps {
	pkg: PackageWithNormalizedData;
}

const PackageListItem = memo(({ pkg }: PackageListItemProps) => {
	const addTag = useFilterStore((state) => state.addTag);

	// Local state for rating data
	const [localPkg, setLocalPkg] = useState<PackageWithNormalizedData>(pkg);
	const mountedRef = useRef(true);

	// Update local package data when props change
	useEffect(() => {
		setLocalPkg(pkg);
	}, [pkg]);


	// Cleanup on unmount
	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const handleTagClick = (event: React.MouseEvent, tag: string) => {
		event.stopPropagation(); // Prevent ListItem's own click if it has one
		addTag(tag);
	};

	return (
		<ListItem
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'flex-start',
				gap: 2,
				minHeight: 140,
				maxHeight: 140,
				py: 2,
				px: 2,
				m: 0,
				borderRadius: 2,
				border: 0,
				overflow: 'hidden',
				background: (theme: Theme) => theme.palette.mode === 'dark'
					? 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(23,23,23,0.8) 100%)'
					: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
				backdropFilter: 'blur(8px)',
				boxShadow: (theme: Theme) => theme.shadows[1],
				transition: (theme: Theme) => theme.transitions.create(['box-shadow', 'background', 'transform'], {
					duration: theme.transitions.duration.short,
				}),
				'&:hover': {
					background: (theme: Theme) => theme.palette.mode === 'dark'
						? 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(23,23,23,0.95) 100%)'
						: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
					boxShadow: (theme: Theme) => `0 0px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
					transform: 'translateY(-2px)',
				},
			}}
			component="div"
		>
			<Box sx={{
				flexGrow: 1,
				display: 'flex',
				flexDirection: 'column',
				mr: 2,
				overflow: 'hidden',
				height: '100%',
				justifyContent: 'space-between'
			}}>
				<ListItemText
					primary={
						<Link
							component={RouterLink}
							to={`/package/${encodeURIComponent(localPkg.id)}`}
							underline="none"
							sx={{
								fontWeight: 600,
								fontSize: '1.05rem',
								position: 'relative',
								transition: 'all 0.2s ease-in-out',
								color: (theme: Theme) => theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
								textDecoration: 'none',
								display: 'block',
								lineHeight: 1.3,
								'&:hover': {
									color: 'primary.main',
									transform: 'translateY(-1px)',
									textDecoration: 'none',
								},
								'&::after': {
									content: '""',
									position: 'absolute',
									width: '100%',
									transform: 'scaleX(0)',
									height: '1.5px',
									bottom: '-1px',
									left: 0,
									backgroundColor: 'primary.main',
									transformOrigin: 'bottom left',
									transition: 'transform 0.25s ease-out',
								},
								'&:hover::after': {
									transform: 'scaleX(1)',
								},
							}}
						>
							{localPkg.package_name}
						</Link>
					}
					sx={{ mt: 0, mb: 1 }}
				/>

				<Box sx={{ height: 36, mb: 1 }}>
					{localPkg.description && (
						<Tooltip title={localPkg.description}>
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									display: '-webkit-box',
									WebkitLineClamp: 2,
									WebkitBoxOrient: 'vertical',
									lineHeight: 1.4,
									height: '100%',
								}}
							>
								{localPkg.description}
							</Typography>
						</Tooltip>
					)}
				</Box>

				<Box sx={{ height: 24, overflow: 'hidden' }}>
					{localPkg.tags && localPkg.tags.length > 0 && (
						<Stack
							direction="row"
							spacing={0.5}
							sx={{
								flexWrap: 'nowrap',
								overflowX: 'auto',
								maxWidth: '100%',
								height: '100%',
								alignItems: 'center',
								'&::-webkit-scrollbar': { height: '4px' },
								'&::-webkit-scrollbar-thumb': {
									backgroundColor: (theme: Theme) => alpha(theme.palette.text.secondary, 0.5),
									borderRadius: '2px',
								},
							}}
						>
							{localPkg.tags.map((tag: string) => (
								<Chip
									key={tag}
									label={tag}
									size="small"
									sx={{
										height: '20px',
										borderRadius: 4,
										bgcolor: (theme: Theme) => theme.palette.mode === 'dark'
											? alpha(theme.palette.primary.main, 0.12)
											: alpha(theme.palette.primary.light, 0.12),
										color: (theme: Theme) => theme.palette.mode === 'dark'
											? theme.palette.primary.light
											: theme.palette.primary.main,
										fontWeight: 500,
										fontSize: '0.7rem',
										flexShrink: 0,
										'&:hover': {
											bgcolor: (theme: Theme) => theme.palette.mode === 'dark'
												? alpha(theme.palette.primary.main, 0.18)
												: alpha(theme.palette.primary.light, 0.18),
										},
										cursor: 'pointer',
									}}
									onClick={(e) => handleTagClick(e, tag)}
								/>
							))}
						</Stack>
					)}
				</Box>
			</Box>

			<Stack direction="column" spacing={1} alignItems="flex-end" sx={{
				flexShrink: 0,
				pt: 0.5,
				height: '100%',
				justifyContent: 'space-between'
			}}>
				<RatingInput
					packageId={localPkg.id}
				/>
				{/* Replaced with PackageActions component */}
				<PackageActions pkg={localPkg} spacing={0.5} />

				{/* Replaced with PackageMetrics component */}
				<PackageMetrics pkg={localPkg} variant="list" spacing={1} />
			</Stack>
		</ListItem>
	);
});

export default PackageListItem;