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
import { Package } from '../types';
import { useFilterStore } from '../store/filterStore';
import { RatingEventEmitter, type RatingUpdateEvent } from '../services/ratingService';
import RatingInput from './RatingInput';
import PackageActions from './common/PackageActions';
import PackageMetrics from './common/PackageMetrics';

interface PackageListItemProps {
	pkg: Package;
}

const PackageListItem = memo(({ pkg }: PackageListItemProps) => {
	const addTag = useFilterStore((state) => state.addTag);

	// Local state for rating data
	const [localPkg, setLocalPkg] = useState<Package>(pkg);
	const mountedRef = useRef(true);

	// Update local package data when props change
	useEffect(() => {
		setLocalPkg(pkg);
	}, [pkg]);

	// Subscribe to rating updates
	useEffect(() => {
		const unsubscribe = RatingEventEmitter.subscribe((event: RatingUpdateEvent) => {
			if (event.packageId === pkg.id && mountedRef.current) {
				setLocalPkg(prevPkg => ({
					...prevPkg,
					average_rating: event.averageRating,
					ratings_count: event.ratingsCount
				}));
			}
		});

		return unsubscribe;
	}, [pkg.id]);

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
				py: 1.5,
				px: 2,
				borderRadius: 2,
				border: 0,
				overflow: 'hidden',
				mb: 1,
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
				'&:last-child': {
					borderBottom: 'none',
					mb: 0,
				},
			}}
			component="div"
		>
			<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', mr: 2, overflow: 'hidden' }}>
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
					sx={{ mt: 0.5, mb: 0.5 }}
				/>
				{localPkg.description && (
					<Tooltip title={localPkg.description}>
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{
								mb: 1.25,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								display: '-webkit-box',
								WebkitLineClamp: 2,
								WebkitBoxOrient: 'vertical',
								lineHeight: 1.5,
							}}
						>
							{localPkg.description}
						</Typography>
					</Tooltip>
				)}
				{localPkg.tags && localPkg.tags.length > 0 && (
					<Stack
						direction="row"
						spacing={0.5}
						sx={{
							flexWrap: 'nowrap',
							overflowX: 'auto',
							maxWidth: '100%',
							pb: 0.5,
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
									height: '22px',
									borderRadius: 4,
									bgcolor: (theme: Theme) => theme.palette.mode === 'dark'
										? alpha(theme.palette.primary.main, 0.12)
										: alpha(theme.palette.primary.light, 0.12),
									color: (theme: Theme) => theme.palette.mode === 'dark'
										? theme.palette.primary.light
										: theme.palette.primary.main,
									fontWeight: 500,
									fontSize: '0.7rem',
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

			<Stack direction="column" spacing={1} alignItems="flex-end" sx={{ flexShrink: 0, pt: 0.5 }}>
				<RatingInput
					packageId={localPkg.id}
					averageRating={localPkg.average_rating ?? 0}
					ratingsCount={localPkg.ratings_count ?? 0}
					userRating={localPkg.user_rating}
					userRatingId={localPkg.user_rating_id}
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