import React, { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Card, CardContent, Typography, Link, Box, Chip, Stack, Divider, Tooltip, Button, IconButton, Popover } from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import { Code as CodeIcon, Article, Language, Link as LinkIcon, MoreHoriz as MoreHorizIcon } from '@mui/icons-material';
import { FiTag, FiStar, FiClock, FiBookOpen } from 'react-icons/fi';
import { Package } from '../types';
import { useFilterStore } from '../store/filterStore';
import RatingInput from './RatingInput';

interface PackageCardProps {
	pkg: Package
}

const PackageCardComponent = ({ pkg }: PackageCardProps) => {
	const addTag = useFilterStore((state) => state.addTag);
	const [tagsPopoverAnchor, setTagsPopoverAnchor] = useState<HTMLButtonElement | null>(null);

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

	// Common button styles
	const buttonStyle = {
		borderRadius: 4,
		textTransform: 'none',
		px: 1.5,
		minWidth: 'auto',
		borderColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.3),
		color: 'primary.main',
		position: 'relative',
		transition: (theme: Theme) => theme.transitions.create(['all'], {
			duration: '0.2s'
		}),
		'&::before': {
			content: '""',
			position: 'absolute',
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
			WebkitMaskComposite: 'xor',
			maskComposite: 'exclude',
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
				background: (theme: Theme) => theme.palette.mode === 'dark'
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
							fontSize: '1.05rem', // Reduced from h6 default size
							color: (theme) => theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
						}}
					>
						<Link
							component={RouterLink}
							to={`/package/${encodeURIComponent(pkg.id)}`}
							underline="none"
							sx={{
								position: 'relative',
								transition: 'all 0.2s ease-in-out',
								color: 'text.primary',
								textDecoration: 'none',
								'&:hover': {
									color: 'primary.main',
									transform: 'translateY(-1px)',
									textDecoration: 'none', // Ensure no underline on hover
								},
								'&::after': {
									content: '""',
									position: 'absolute',
									width: '100%',
									transform: 'scaleX(0)',
									height: '1.5px', // Changed from 1px
									bottom: '-1px',  // Changed from 0
									left: 0,
									backgroundColor: 'primary.main',
									transformOrigin: 'bottom left', // Changed from 'bottom right'
									transition: 'transform 0.25s ease-out',
								},
								'&:hover::after': {
									transform: 'scaleX(1)',
									// transformOrigin: 'bottom left' // Removed as it's set in &::after
								},
							}}
						>
							{pkg.package_name}
						</Link>
					</Typography>

					{/* Rating in top right */}
					<Box sx={{ flexShrink: 0 }}>
						<RatingInput
							packageId={pkg.id}
							initialAverageRating={pkg.average_rating ?? 0}
							initialRatingsCount={pkg.ratings_count ?? 0}
						/>
					</Box>
				</Box>

				<Tooltip title={pkg.description}>
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{
							mb: 1.25, // Reduced from 2
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							display: '-webkit-box',
							WebkitLineClamp: 3,
							WebkitBoxOrient: 'vertical',
							lineHeight: 1.5,
						}}
					>
						{pkg.description}
					</Typography>
				</Tooltip>

				{/* Spacer to push content below to the bottom */}
				<Box sx={{ flexGrow: 1 }} />

				{/* Links Row - Redesigned as buttons with reduced top padding */}
				<Stack direction="row" spacing={1} sx={{ pt: 1, flexWrap: 'wrap', gap: 1 }}>
					{/* Code Repository */}
					{(pkg.repo_link || pkg.repository) && (
						<Button
							href={pkg.repo_link || pkg.repository || ''}
							target="_blank"
							rel="noopener noreferrer"
							variant="outlined"
							size="small"
							startIcon={<CodeIcon fontSize="small" />}
							sx={buttonStyle}
						>
							Code
						</Button>
					)}

					{/* Publication */}
					{pkg.publication && (
						<Button
							href={pkg.publication || ''}
							target="_blank"
							rel="noopener noreferrer"
							variant="outlined"
							size="small"
							startIcon={<Article fontSize="small" />}
							sx={buttonStyle}
						>
							Publication
						</Button>
					)}

					{/* Webserver */}
					{pkg.webserver && (
						<Button
							href={pkg.webserver || ''}
							target="_blank"
							rel="noopener noreferrer"
							variant="outlined"
							size="small"
							startIcon={<Language fontSize="small" />}
							sx={buttonStyle}
						>
							Web
						</Button>
					)}

					{/* Link */}
					{pkg.link && (
						<Button
							href={pkg.link || ''}
							target="_blank"
							rel="noopener noreferrer"
							variant="outlined"
							size="small"
							startIcon={<LinkIcon fontSize="small" />}
							sx={buttonStyle}
						>
							Link
						</Button>
					)}
				</Stack>

				{/* Info Chips Row - only shown when there's at least one metric to display */}
				{((typeof pkg.github_stars !== 'undefined' && pkg.github_stars > 0) ||
					pkg.last_commit_ago ||
					(typeof pkg.citations !== 'undefined' && pkg.citations >= 0)) && (
						<Stack direction="row" spacing={1} sx={{ pt: 1, flexWrap: 'wrap', gap: 0.75 }}>
							{/* GitHub Stars - only shown when not null and > 0 */}
							{typeof pkg.github_stars !== 'undefined' && pkg.github_stars > 0 && (
								<Tooltip title="GitHub Stars" arrow>
									<Chip
										icon={<FiStar size={14} />}
										label={`${pkg.github_stars}`}
										size="small"
										variant="outlined"
										sx={{
											borderRadius: 4,
											border: 'none',
											bgcolor: 'transparent',
											'& .MuiChip-label': {
												px: 1,
												fontSize: '0.75rem',
											},
											'& .MuiChip-icon': {
												color: 'warning.main',
											},
											'&:hover': {
												bgcolor: 'transparent'
											},
										}}
									/>
								</Tooltip>
							)}

							{/* Last Commit - only shown when not null */}
							{pkg.last_commit_ago && (
								<Tooltip title="Last Update" arrow>
									<Chip
										icon={<FiClock size={14} />}
										label={pkg.last_commit_ago.replace(' months ago', 'mo')}
										size="small"
										variant="outlined"
										sx={{
											borderRadius: 4,
											border: 'none',
											bgcolor: 'transparent',
											'& .MuiChip-label': {
												px: 1,
												fontSize: '0.75rem',
											},
											'& .MuiChip-icon': {
												color: 'info.main',
											},
											'&:hover': {
												bgcolor: 'transparent'
											},
										}}
									/>
								</Tooltip>
							)}

							{/* Citations - only shown when not null and >= 0 */}
							{typeof pkg.citations !== 'undefined' && pkg.citations >= 0 && (
								<Tooltip title="Citations" arrow>
									<Chip
										icon={<FiBookOpen size={14} />}
										label={`${pkg.citations}`}
										size="small"
										variant="outlined"
										sx={{
											borderRadius: 4,
											border: 'none',
											bgcolor: 'transparent',
											'& .MuiChip-label': {
												px: 1,
												fontSize: '0.75rem',
											},
											'& .MuiChip-icon': {
												color: 'success.main',
											},
											'&:hover': {
												bgcolor: 'transparent'
											},
										}}
									/>
								</Tooltip>
							)}
						</Stack>
					)}
			</CardContent>

			{/* Tags Section - with consistent height and "See All Tags" button */}
			{pkg.tags && pkg.tags.length > 0 && (
				<>
					<Divider sx={{ mx: 0 }} />
					<CardContent
						sx={{
							pt: 1.25,
							pb: '12px !important',
							px: 2,
							height: '76px', // Increased height for better display of 2 rows of tags
							position: 'relative',
							overflow: 'hidden'
						}}
					>
						<Stack direction="row" alignItems="flex-start" spacing={1}>
							<Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'text.secondary', mt: 0.5 }}>
								<FiTag size={14} />
							</Box>

							{/* Tags container with limited height to show max 2 rows */}
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 0.75,
									alignItems: 'flex-start',
									minWidth: 0,
									maxWidth: 'calc(100% - 50px)', // Make room for the "more" button
									maxHeight: '62px', // Increased to better show 2 rows of tags
									overflow: 'hidden',
									pr: 1
								}}
							>
								{pkg.tags.map((tag: string) => (
									<Chip
										key={tag}
										label={tag}
										size="small"
										sx={{
											height: '22px',
											borderRadius: 4,
											bgcolor: (theme) => theme.palette.mode === 'dark'
												? alpha(theme.palette.primary.main, 0.12)
												: alpha(theme.palette.primary.light, 0.12),
											color: (theme) => theme.palette.mode === 'dark'
												? theme.palette.primary.light
												: theme.palette.primary.main,
											fontWeight: 500,
											fontSize: '0.7rem',
											mb: 0.35,
											'&:hover': {
												bgcolor: (theme) => theme.palette.mode === 'dark'
													? alpha(theme.palette.primary.main, 0.18)
													: alpha(theme.palette.primary.light, 0.18),
											},
											cursor: 'pointer',
										}}
										onClick={() => handleTagClick(tag)}
									/>
								))}
							</Box>

							{/* "See All Tags" button */}
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

						{/* Tags popover */}
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
								{pkg.tags.map((tag: string) => (
									<Chip
										key={tag}
										label={tag}
										size="small"
										sx={{
											height: '24px',
											borderRadius: 4,
											bgcolor: (theme) => theme.palette.mode === 'dark'
												? alpha(theme.palette.primary.main, 0.12)
												: alpha(theme.palette.primary.light, 0.12),
											color: (theme) => theme.palette.mode === 'dark'
												? theme.palette.primary.light
												: theme.palette.primary.main,
											fontWeight: 500,
											fontSize: '0.7rem',
											mb: 0.5,
											'&:hover': {
												bgcolor: (theme) => theme.palette.mode === 'dark'
													? alpha(theme.palette.primary.main, 0.18)
													: alpha(theme.palette.primary.light, 0.18),
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