import React, { memo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ListItem, ListItemText, Typography, Link, Box, Stack, IconButton, Tooltip, Chip, Button, Theme } from '@mui/material'; // Added Button, Theme
import { alpha } from '@mui/material/styles';
import { Code as CodeIcon, Article, Language, Link as LinkIconMui } from '@mui/icons-material'; // Added Article, Language, LinkIconMui
import { FiStar, FiClock, FiBookOpen } from 'react-icons/fi'; // Removed FiFileText, FiGlobe, FiLink
import { Package } from '../types';
import { useFilterStore } from '../store/filterStore';
import RatingInput from './RatingInput';

interface PackageListItemProps {
	pkg: Package;
}

// Copied buttonStyle from PackageCard.tsx
const buttonStyle = {
	borderRadius: 4,
	textTransform: 'none' as const, // Ensure 'none' is treated as a literal type
	px: 1.5,
	minWidth: 'auto',
	borderColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.3),
	color: 'primary.main',
	position: 'relative' as const, // Ensure 'relative' is treated as a literal type
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
		boxShadow: (theme: Theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`, // Adjusted boxShadow alpha
	}
};


const PackageListItem = memo(({ pkg }: PackageListItemProps) => {
	const addTag = useFilterStore((state) => state.addTag);

	const handleTagClick = (event: React.MouseEvent, tag: string) => {
		event.stopPropagation();
		addTag(tag);
	};

	const formatLastCommitAgo = (lastCommitAgo?: string) => {
		if (!lastCommitAgo) return '';
		return lastCommitAgo.replace(' months ago', 'mo').replace(' days ago', 'd').replace(' hours ago', 'h').replace(' minutes ago', 'm').replace(' seconds ago', 's');
	};

	return (
		<ListItem
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'flex-start', // Align items to the top
				gap: 2,
				py: 1.5,
				px: 2,
				borderRadius: 1,
				border: 'none', // Consistent with previous state
				mb: 1,
				background: (theme) => theme.palette.mode === 'dark'
					? 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(23,23,23,0.8) 100%)'
					: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
				backdropFilter: 'blur(8px)',
				boxShadow: (theme) => theme.shadows[1],
				transition: (theme) => theme.transitions.create(['box-shadow', 'background', 'transform'], {
					duration: theme.transitions.duration.short,
				}),
				'&:hover': {
					background: (theme) => theme.palette.mode === 'dark'
						? 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(23,23,23,0.95) 100%)'
						: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
					boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`, // Adjusted boxShadow alpha
					transform: 'translateY(-1px)',
				},
				'&:last-child': {
					borderBottom: 'none',
					mb: 0,
				},
			}}
			button
			component="div" // To allow complex children structure for flex
		>
			<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', mr: 2, overflow: 'hidden' }}>
				<ListItemText
					primary={
						<Link
							component={RouterLink}
							to={`/package/${encodeURIComponent(pkg.id)}`}
							underline="none" // Explicitly set to none
							sx={{
								fontWeight: 'medium', // Preserved from original
								fontSize: '1rem',    // Preserved from original
								position: 'relative',
								transition: 'all 0.2s ease-in-out',
								color: 'text.primary',
								textDecoration: 'none', // Ensure no underline in base state
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
							{pkg.package_name}
						</Link>
					}
					sx={{ mt: 0.5, mb: 0.5 }} // Adjusted margin
				/>
				{pkg.description && (
					<Tooltip title={pkg.description}>
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{
								mb: 1, // Margin below description
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								display: '-webkit-box',
								WebkitLineClamp: 2, // Show 2 lines for description in list item
								WebkitBoxOrient: 'vertical',
								lineHeight: 1.5,
								minHeight: '48px', // Assuming lineHeight 1.5 * 16px font * 2 lines = 48px. Adjust if base font size differs.
							}}
						>
							{pkg.description}
						</Typography>
					</Tooltip>
				)}
				{pkg.tags && pkg.tags.length > 0 && (
					<Stack
						direction="row"
						spacing={0.5}
						sx={{
							flexWrap: 'nowrap', // Single line for tags
							overflowX: 'auto',   // Allow horizontal scrolling for tags
							maxWidth: '100%',     // Ensure it doesn't break layout
							pb: 0.5, // Padding at the bottom of the scrollbar
							'&::-webkit-scrollbar': { height: '4px' },
							'&::-webkit-scrollbar-thumb': {
								backgroundColor: (theme) => alpha(theme.palette.text.secondary, 0.5),
								borderRadius: '2px',
							},
						}}
					>
						{pkg.tags.map((tag: string) => (
							<Chip
								key={tag}
								label={tag}
								size="small"
								sx={{
									height: '22px',
									borderRadius: '4px',
									bgcolor: (theme) => theme.palette.mode === 'dark'
										? alpha(theme.palette.primary.main, 0.12)
										: alpha(theme.palette.primary.light, 0.12),
									color: (theme) => theme.palette.mode === 'dark'
										? theme.palette.primary.light
										: theme.palette.primary.main,
									fontWeight: 500,
									fontSize: '0.7rem',
									// mb: 0.35, // Margin bottom handled by Stack spacing or pb on Stack
									'&:hover': {
										bgcolor: (theme) => theme.palette.mode === 'dark'
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
					packageId={pkg.id}
					initialAverageRating={pkg.average_rating ?? 0}
					initialRatingsCount={pkg.ratings_count ?? 0}
				/>
				<Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 'auto !important', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.5 }}> {/* Added flexWrap and gap for buttons */}
					{(pkg.repo_link || pkg.repository) && (
						<Tooltip title="Code">
							<Button
								href={(pkg.repo_link || pkg.repository) as string}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								startIcon={<CodeIcon fontSize="small" />}
								sx={buttonStyle}
								aria-label="Code Link"
							>
								Code
							</Button>
						</Tooltip>
					)}
					{pkg.publication && (
						<Tooltip title="Publication">
							<Button
								href={pkg.publication as string}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								startIcon={<Article fontSize="small" />}
								sx={buttonStyle}
								aria-label="Publication Link"
							>
								Publication
							</Button>
						</Tooltip>
					)}
					{pkg.webserver && (
						<Tooltip title="Webserver">
							<Button
								href={pkg.webserver as string}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								startIcon={<Language fontSize="small" />}
								sx={buttonStyle}
								aria-label="Webserver Link"
							>
								Web
							</Button>
						</Tooltip>
					)}
					{pkg.link && (
						<Tooltip title="Link">
							<Button
								href={pkg.link as string}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								startIcon={<LinkIconMui fontSize="small" />}
								sx={buttonStyle}
								aria-label="External Link"
							>
								Link
							</Button>
						</Tooltip>
					)}
				</Stack>
				<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
					{pkg.github_stars !== undefined && pkg.github_stars >= 1 && (
						<Tooltip title="GitHub Stars">
							<Chip
								icon={<FiStar size={14} style={{ color: alpha('#FFC107', 0.9) }} />} // warning.main equivalent
								label={`${pkg.github_stars}`}
								size="small"
								variant="outlined"
								sx={{ borderRadius: '4px', border: 'none', bgcolor: 'transparent', '& .MuiChip-label': { px: 0.5, fontSize: '0.75rem', color: 'text.secondary' }, '& .MuiChip-icon': { ml: '4px' } }}
							/>
						</Tooltip>
					)}
					{pkg.last_commit_ago && (
						<Tooltip title="Last Commit">
							<Chip
								icon={<FiClock size={14} style={{ color: alpha('#2196F3', 0.9) }} />} // info.main equivalent
								label={formatLastCommitAgo(pkg.last_commit_ago)}
								size="small"
								variant="outlined"
								sx={{ borderRadius: '4px', border: 'none', bgcolor: 'transparent', '& .MuiChip-label': { px: 0.5, fontSize: '0.75rem', color: 'text.secondary' }, '& .MuiChip-icon': { ml: '4px' } }}
							/>
						</Tooltip>
					)}
					{pkg.citations !== undefined && (
						<Tooltip title="Citations">
							<Chip
								icon={<FiBookOpen size={14} style={{ color: alpha('#4CAF50', 0.9) }} />} // success.main equivalent
								label={`${pkg.citations}`}
								size="small"
								variant="outlined"
								sx={{ borderRadius: '4px', border: 'none', bgcolor: 'transparent', '& .MuiChip-label': { px: 0.5, fontSize: '0.75rem', color: 'text.secondary' }, '& .MuiChip-icon': { ml: '4px' } }}
							/>
						</Tooltip>
					)}
				</Stack>
			</Stack>
		</ListItem>
	);
});

export default PackageListItem;