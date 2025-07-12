// src/components/PackageCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
	Card,
	CardContent,
	Typography,
	Link,
	Box,
	Chip,
	Stack,
	Divider,
	Tooltip,
	IconButton,
	Popover,
	Theme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material';
import { FiTag } from 'react-icons/fi';
import { Package } from '../types';
import { useFilterStore } from '../store/filterStore';
import RatingInput from './RatingInput';
import PackageActions from './common/PackageActions';
import PackageMetrics from './common/PackageMetrics';

interface PackageCardProps {
	pkg: Package;
}

const PackageCardComponent = ({ pkg }: PackageCardProps) => {
	const addTag = useFilterStore((state) => state.addTag);
	const [tagsPopoverAnchor, setTagsPopoverAnchor] = useState<HTMLButtonElement | null>(null);

	// Local state for rating data
	const [localPkg, setLocalPkg] = useState<Package>(pkg);
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

	const handleTagClick = (tag: string) => {
		addTag(tag);
	};

	const handleTagsMoreClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		setTagsPopoverAnchor(event.currentTarget);
	};

	const handleTagsPopoverClose = () => {
		setTagsPopoverAnchor(null);
	};

	const tagsPopoverOpen = Boolean(tagsPopoverAnchor);

	return (
		<Card
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				transition: (theme: Theme) => theme.transitions.create(['box-shadow', 'transform', 'background'], {
					duration: theme.transitions.duration.short,
				}),
				'&:hover': {
					boxShadow: (theme: Theme) => `0 0px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
					transform: 'translateY(-2px)',
					background: (theme: Theme) => theme.palette.mode === 'dark'
						? 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(23,23,23,0.95) 100%)'
						: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
				},
				background: (theme) => theme.palette.mode === 'dark'
					? 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(23,23,23,0.8) 100%)'
					: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
				backdropFilter: 'blur(8px)',
				border: 0,
				overflow: 'hidden',
				borderRadius: 2,
			}}
		>
			<CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, pb: 1.5 }}>
				{/* Header with title and rating side by side */}
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
					{/* Title */}
					<Typography
						variant="h6"
						component="h2"
						sx={{
							fontWeight: 600,
							pr: 2, // Add padding to prevent overlap with rating
							flexGrow: 1,
							fontSize: '1.05rem',
							color: (theme) => theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
						}}
					>
						<Link
							component={RouterLink}
							to={`/package/${encodeURIComponent(localPkg.id)}`}
							underline="none"
							sx={{
								position: 'relative',
								transition: 'all 0.2s ease-in-out',
								color: 'text.primary',
								'&:hover': {
									color: (theme) => theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.main,
									transform: 'translateY(-1px)',
								},
								'&::after': {
									content: '""',
									position: 'absolute',
									width: '100%',
									transform: 'scaleX(0)',
									height: '1px',
									bottom: 0,
									left: 0,
									backgroundColor: 'primary.main',
									transformOrigin: 'bottom right',
									transition: 'transform 0.25s ease-out'
								},
								'&:hover::after': {
									transform: 'scaleX(1)',
									transformOrigin: 'bottom left'
								}
							}}
						>
							{localPkg.package_name}
						</Link>
					</Typography>

					{/* Rating in top right */}
					<Box sx={{ flexShrink: 0 }}>
						<RatingInput
							packageId={localPkg.id}
						/>
					</Box>
				</Box>

				<Tooltip title={localPkg.description}>
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{
							mb: 1.25,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							display: '-webkit-box',
							WebkitLineClamp: 3,
							WebkitBoxOrient: 'vertical',
							lineHeight: 1.5,
						}}
					>
						{localPkg.description}
					</Typography>
				</Tooltip>

				{/* Spacer to push content below to the bottom */}
				<Box sx={{ flexGrow: 1 }} />

				{/* Links Row - Replaced with PackageActions component */}
				<Box sx={{ pt: 1 }}>
					<PackageActions pkg={localPkg} />
				</Box>

				{/* Info Chips Row - Replaced with PackageMetrics component */}
				<Box sx={{ pt: 1 }}>
					<PackageMetrics pkg={localPkg} variant="card" />
				</Box>
			</CardContent>

			{/* Tags Section - with consistent height and "See All Tags" button */}
			{localPkg.tags && localPkg.tags.length > 0 && (
				<>
					<Divider sx={{ mx: 0 }} />
					<CardContent
						sx={{
							pt: 1.25,
							pb: '12px !important',
							px: 2,
							height: '76px',
							position: 'relative',
							overflow: 'hidden'
						}}
					>
						<Stack direction="row" alignItems="flex-start" spacing={1}>
							<Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'text.secondary', mt: 0.5 }}>
								<FiTag size={14} />
							</Box>

							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 0.75,
									alignItems: 'flex-start',
									minWidth: 0,
									maxWidth: 'calc(100% - 50px)',
									maxHeight: '62px',
									overflow: 'hidden',
									pr: 1
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
											bgcolor: (theme) => theme.palette.mode === 'dark'
												? alpha(theme.palette.primary.main, 0.15)
												: alpha(theme.palette.primary.light, 0.15),
											color: 'primary.main',
											fontWeight: 500,
											fontSize: '0.7rem',
											mb: 0.35,
											'&:hover': {
												bgcolor: (theme) => theme.palette.mode === 'dark'
													? alpha(theme.palette.primary.main, 0.25)
													: alpha(theme.palette.primary.light, 0.25),
											},
											cursor: 'pointer',
										}}
										onClick={() => handleTagClick(tag)}
									/>
								))}
							</Box>

							<Box sx={{ position: 'absolute', right: 8, top: 10 }}>
								<Tooltip title="See All Tags" arrow>
									<IconButton
										size="small"
										onClick={handleTagsMoreClick}
										sx={{
											width: 28,
											height: 28,
											bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
											color: 'primary.main',
											'&:hover': {
												bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
											}
										}}
									>
										<MoreHorizIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</Box>
						</Stack>

						<Popover
							open={tagsPopoverOpen}
							anchorEl={tagsPopoverAnchor}
							onClose={handleTagsPopoverClose}
							anchorOrigin={{
								vertical: 'bottom',
								horizontal: 'right',
							}}
							transformOrigin={{
								vertical: 'top',
								horizontal: 'right',
							}}
							PaperProps={{
								sx: {
									p: 2,
									maxWidth: 320,
									boxShadow: 3
								}
							}}
						>
							<Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
								All Tags
							</Typography>
							<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
								{localPkg.tags.map((tag: string) => (
									<Chip
										key={tag}
										label={tag}
										size="small"
										sx={{
											height: '24px',
											borderRadius: 4,
											bgcolor: (theme) => theme.palette.mode === 'dark'
												? alpha(theme.palette.primary.main, 0.15)
												: alpha(theme.palette.primary.light, 0.15),
											color: 'primary.main',
											fontWeight: 500,
											fontSize: '0.7rem',
											mb: 0.5,
											'&:hover': {
												bgcolor: (theme) => theme.palette.mode === 'dark'
													? alpha(theme.palette.primary.main, 0.25)
													: alpha(theme.palette.primary.light, 0.25),
											},
											cursor: 'pointer',
										}}
										onClick={() => {
											handleTagClick(tag);
											handleTagsPopoverClose();
										}}
									/>
								))}
							</Box>
						</Popover>
					</CardContent>
				</>
			)}
		</Card>
	);
};

export default PackageCardComponent;