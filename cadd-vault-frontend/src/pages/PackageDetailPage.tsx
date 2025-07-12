// src/pages/PackageDetailPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Paper, Button, CircularProgress, Link, Chip, useTheme, Theme, Stack, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { supabase } from '../supabase';
import { Package } from '../types';
import { Gavel, MenuBook, Edit, Code as CodeIcon, Article, Language, Link as LinkIcon, Delete, FolderOutlined, CategoryOutlined } from '@mui/icons-material';
import { FiStar, FiClock, FiBookOpen } from 'react-icons/fi';
import RatingInput from '../components/RatingInput';
import { useAuth } from '../context/AuthContext';

const buttonStyle = {
	borderRadius: 4,
	textTransform: 'none' as const,
	px: 1.5,
	minWidth: 'auto',
	borderColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.3),
	color: 'primary.main',
	transition: (theme: Theme) => theme.transitions.create(['all'], {
		duration: '0.2s'
	}),
	'&::before': {
		content: '""',
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

// Define styling for full-width buttons at the bottom of sections
const fullWidthButtonStyle = {
	...buttonStyle,
	width: '100%',
	justifyContent: 'center',
	mt: 'auto',
	mb: 0
};

// Define the styling for links in the detail page
const linkStyle = {
	position: 'relative',
	transition: 'all 0.2s ease-in-out',
	color: 'text.primary',
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
};

const PackageDetailPage: React.FC = () => {
	const theme = useTheme();
	const { packageId: encodedPackageId } = useParams<{ packageId: string }>();
	const navigate = useNavigate();
	const { isAdmin, currentUser } = useAuth();
	const packageId = encodedPackageId ? decodeURIComponent(encodedPackageId) : undefined;
	
	// Stable user ID to prevent unnecessary re-renders due to object reference changes
	const userId = currentUser?.id || null;

	// State
	const [packageData, setPackageData] = useState<Package | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

	// Refs
	const mountedRef = useRef(true);

	// Event handlers
	const handleEditClick = () => {
		if (packageId) {
			navigate(`/edit-package/${encodeURIComponent(packageId)}`);
		}
	};

	const handleDeleteClick = () => {
		setOpenDeleteConfirm(true);
	};

	const handleConfirmDelete = async () => {
		if (!packageId) {
			setError('Package ID is missing for deletion.');
			setOpenDeleteConfirm(false);
			return;
		}
		try {
			const { error: deleteError } = await supabase
				.from('packages')
				.delete()
				.eq('id', packageId);

			if (deleteError) {
				throw deleteError;
			}
			setOpenDeleteConfirm(false);
			navigate('/'); // Navigate to homepage after deletion
		} catch (err: any) {
			console.error("Error deleting package:", err);
			setError(`Failed to delete package: ${err?.message || 'Unknown error'}`);
			setOpenDeleteConfirm(false);
		}
	};

	const handleCloseDeleteConfirm = () => {
		setOpenDeleteConfirm(false);
	};

	// Helper to calculate time ago
	const timeAgo = (date: string | Date | null | undefined): string => {
		if (!date) return 'N/A';

		try {
			const d = date instanceof Date ? date : new Date(date);
			if (isNaN(d.getTime())) return 'N/A';

			const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
			let interval = seconds / 31536000;
			if (interval > 1) return Math.floor(interval) + " years ago";
			interval = seconds / 2592000;
			if (interval > 1) return Math.floor(interval) + " months ago";
			interval = seconds / 86400;
			if (interval > 1) return Math.floor(interval) + " days ago";
			interval = seconds / 3600;
			if (interval > 1) return Math.floor(interval) + " hours ago";
			interval = seconds / 60;
			if (interval > 1) return Math.floor(interval) + " minutes ago";
			return Math.floor(seconds) + " seconds ago";
		} catch {
			return 'N/A';
		}
	};

	// Effects
	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchPackage = async () => {
			if (!packageId || !mountedRef.current) return;

			setLoading(true);
			setError(null);

			try {
				// Fetch package with all relationships
				const { data: packageData, error: packageError } = await supabase
					.from('packages')
					.select(`
						*,
						package_tags!left(
							tags!inner(name)
						),
						package_folder_categories!left(
							folder_categories!inner(
								folders!inner(name),
								categories!inner(name)
							)
						)
					`)
					.eq('id', packageId)
					.single();

				if (packageError) throw packageError;

				if (packageData) {
					// Transform the data
					const transformedPackage = {
						...packageData,
						tags: packageData.package_tags?.map((pt: any) => pt.tags?.name) || [],
						folder1: packageData.package_folder_categories?.[0]?.folder_categories?.folders?.name || '',
						category1: packageData.package_folder_categories?.[0]?.folder_categories?.categories?.name || ''
					};

					// Get user rating if authenticated
					if (userId) {
						const { data: ratingData } = await supabase
							.rpc('get_user_rating', { package_uuid: packageId });

						if (ratingData && ratingData.length > 0) {
							transformedPackage.user_rating = ratingData[0].rating;
							transformedPackage.user_rating_id = ratingData[0].rating_id;
						}
					}

					setPackageData(transformedPackage);
				}
			} catch (err: any) {
				console.error("Error fetching package:", err);
				setError(`Failed to fetch package data: ${err.message}`);
			} finally {
				setLoading(false);
			}
		};

		fetchPackage();
	}, [packageId, userId]);


	// Loading state
	if (loading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

	// Error state
	if (error) {
		return <Typography color="error" align="center">{error}</Typography>;
	}

	// No data state
	if (!packageData) {
		return <Typography align="center">Package data is not available.</Typography>;
	}

	return (
		<Paper elevation={3} sx={{
			p: 3,
			m: 2,
			position: 'relative',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			transition: (theme: Theme) => theme.transitions.create(['box-shadow', 'transform', 'background'], {
				duration: theme.transitions.duration.short,
			}),
			background: (theme) => theme.palette.mode === 'dark'
				? 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(23,23,23,0.8) 100%)'
				: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
			backdropFilter: 'blur(8px)',
			border: 0,
			overflow: 'hidden',
			borderRadius: 2,
		}}>
			{/* Admin Controls */}
			{isAdmin && (
				<Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 16, right: 16 }}>
					<Button
						variant="outlined"
						startIcon={<Edit fontSize="small" />}
						onClick={handleEditClick}
						sx={buttonStyle}
					>
						Edit
					</Button>
					<Button
						variant="outlined"
						startIcon={<Delete fontSize="small" />}
						onClick={handleDeleteClick}
						sx={{ ...buttonStyle, borderColor: theme.palette.error.main, color: theme.palette.error.main, '&:hover': { borderColor: theme.palette.error.dark, bgcolor: alpha(theme.palette.error.main, 0.1) } }}
					>
						Delete
					</Button>
				</Stack>
			)}

			{/* Rating in top right corner */}
			{packageId && (
				<Box sx={{ position: 'absolute', top: 20, right: isAdmin ? (packageData?.package_name && packageData.package_name.length > 15 ? 300 : 210) : 16, zIndex: 1 }}>
					<RatingInput
						packageId={packageId}
					/>
				</Box>
			)}

			{/* Title */}
			<Typography variant="h4" gutterBottom component="div" sx={{
				pr: isAdmin ? '100px' : 0,
				fontWeight: 600,
				fontSize: '2rem',
				color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
			}}>
				{packageData.package_name || 'Unnamed Package'}
			</Typography>

			{/* Description */}
			<Box mb={3}>
				<Typography variant="body1" paragraph sx={{
					whiteSpace: 'pre-wrap',
					lineHeight: 1.5,
					color: 'text.secondary'
				}}>
					{packageData.description || 'No description available.'}
				</Typography>
			</Box>

			{/* Main Content Grid */}
			<Grid container spacing={4} mb={3}>
				{/* Code Section */}
				<Grid item xs={12} md={4}>
					<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
						<Typography variant="h6" gutterBottom sx={{
							fontWeight: 600,
							fontSize: '1.25rem',
							color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
						}}>Code</Typography>

						{/* Repository Link */}
						<Box mb={2}>
							<Typography variant="subtitle1" fontWeight="bold" sx={{
								display: 'flex',
								alignItems: 'center',
								color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
							}}>
								<CodeIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
								Repository
							</Typography>
							{packageData.repository ? (
								<Link
									href={packageData.repository}
									target="_blank"
									rel="noopener noreferrer"
									sx={linkStyle}
								>
									{packageData.repository}
								</Link>
							) : packageData.repo_link ? (
								<Link
									href={packageData.repo_link}
									target="_blank"
									rel="noopener noreferrer"
									sx={linkStyle}
								>
									{packageData.repo_link}
								</Link>
							) : (
								<Typography variant="body2">N/A</Typography>
							)}
						</Box>

						{/* GitHub Stars */}
						{typeof packageData.github_stars === 'number' && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
									<FiStar style={{ marginRight: '8px', color: theme.palette.warning.main }} />
									Github Stars
								</Typography>
								<Typography variant="body2">{packageData.github_stars}</Typography>
							</Box>
						)}

						{/* Last Commit */}
						{packageData.last_commit && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
									<FiClock style={{ marginRight: '8px', color: theme.palette.info.main }} />
									Last Commit
								</Typography>
								<Typography variant="body2">{timeAgo(packageData.last_commit)}</Typography>
							</Box>
						)}

						{/* License */}
						<Box mb={2}>
							<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
								<Gavel sx={{ mr: 1, color: theme.palette.info.main }} />
								License
							</Typography>
							<Typography variant="body2">{packageData.license || 'N/A'}</Typography>
						</Box>

						{/* Spacer to push button to bottom */}
						<Box sx={{ flexGrow: 1 }} />

						{/* Code Repository Button at bottom of section */}
						{(packageData.repo_link || packageData.repository || (packageData.github_owner && packageData.github_repo)) && (
							<Button
								href={packageData.repository || (packageData.github_owner && packageData.github_repo ? `https://github.com/${packageData.github_owner}/${packageData.github_repo}` : packageData.repo_link) || ''}
								target="_blank"
								rel="noopener noreferrer"
								variant="outlined"
								startIcon={<CodeIcon fontSize="small" />}
								sx={fullWidthButtonStyle}
							>
								View Repository
							</Button>
						)}
					</Box>
				</Grid>

				{/* Publication Section */}
				<Grid item xs={12} md={4}>
					<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
						<Typography variant="h6" gutterBottom sx={{
							fontWeight: 600,
							fontSize: '1.25rem',
							color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
						}}>Publication</Typography>

						{/* Publication Link */}
						{packageData.publication && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
									<MenuBook sx={{ mr: 1, color: theme.palette.success.main }} />
									Publication / DOI
								</Typography>
								{/* Check if it's a DOI link or a general publication link */}
								{packageData.publication.startsWith('http') || packageData.publication.startsWith('www') ? (
									<Link
										href={packageData.publication}
										target="_blank"
										rel="noopener noreferrer"
										sx={linkStyle}
									>
										View Publication
									</Link>
								) : (
									<Link
										href={`https://doi.org/${packageData.publication}`}
										target="_blank"
										rel="noopener noreferrer"
										sx={linkStyle}
									>
										{packageData.publication}
									</Link>
								)}
							</Box>
						)}

						{/* Citations */}
						{typeof packageData.citations === 'number' && packageData.citations > 0 && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
									<FiBookOpen style={{ marginRight: '8px', color: theme.palette.success.main }} />
									Citations
								</Typography>
								<Typography variant="body2">{packageData.citations}</Typography>
							</Box>
						)}

						{/* Spacer to push button to bottom */}
						<Box sx={{ flexGrow: 1 }} />

						{/* Publication Button at bottom of section */}
						{packageData.publication && (
							<Button
								href={packageData.publication.startsWith('http') || packageData.publication.startsWith('www') ? packageData.publication : `https://doi.org/${packageData.publication}`}
								target="_blank"
								rel="noopener noreferrer"
								variant="outlined"
								startIcon={<Article fontSize="small" />}
								sx={fullWidthButtonStyle}
							>
								View Publication
							</Button>
						)}
					</Box>
				</Grid>

				{/* Other Section */}
				<Grid item xs={12} md={4}>
					<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
						<Typography variant="h6" gutterBottom sx={{
							fontWeight: 600,
							fontSize: '1.25rem',
							color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
						}}>Other</Typography>

						{/* Folder */}
						{packageData.folder1 && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
									<FolderOutlined sx={{ mr: 1, color: theme.palette.primary.main }} />
									Folder
								</Typography>
								<Typography variant="body2">{packageData.folder1}</Typography>
							</Box>
						)}

						{/* Category */}
						{packageData.category1 && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', color: theme.palette.text.primary }}>
									<CategoryOutlined sx={{ mr: 1, color: theme.palette.secondary.main }} />
									Category
								</Typography>
								<Typography variant="body2">{packageData.category1}</Typography>
							</Box>
						)}

						{/* Webserver */}
						{packageData.webserver && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ color: theme.palette.text.primary }}>Webserver/Homepage</Typography>
								<Link
									href={packageData.webserver}
									target="_blank"
									rel="noopener noreferrer"
									sx={linkStyle}
								>
									{packageData.webserver}
								</Link>
							</Box>
						)}

						{/* General Link */}
						{packageData.link && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ color: theme.palette.text.primary }}>Link</Typography>
								<Link
									href={packageData.link}
									target="_blank"
									rel="noopener noreferrer"
									sx={linkStyle}
								>
									{packageData.link}
								</Link>
							</Box>
						)}

						{/* Version if available */}
						{packageData.version && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ color: theme.palette.text.primary }}>Version</Typography>
								<Typography variant="body2">{packageData.version}</Typography>
							</Box>
						)}

						{/* Name if available and different from package_name */}
						{packageData.name && packageData.name !== packageData.package_name && (
							<Box mb={2}>
								<Typography variant="subtitle1" fontWeight="bold" sx={{ color: theme.palette.text.primary }}>Package Name</Typography>
								<Typography variant="body2">{packageData.name}</Typography>
							</Box>
						)}

						{/* Spacer to push buttons to bottom */}
						<Box sx={{ flexGrow: 1 }} />

						{/* Button container for Other section */}
						<Stack direction="column" spacing={1} width="100%">
							{/* Webserver Button */}
							{packageData.webserver && (
								<Button
									href={packageData.webserver}
									target="_blank"
									rel="noopener noreferrer"
									variant="outlined"
									startIcon={<Language fontSize="small" />}
									sx={fullWidthButtonStyle}
								>
									Visit Webserver
								</Button>
							)}

							{/* General Link Button */}
							{packageData.link && (
								<Button
									href={packageData.link}
									target="_blank"
									rel="noopener noreferrer"
									variant="outlined"
									startIcon={<LinkIcon fontSize="small" />}
									sx={fullWidthButtonStyle}
								>
									Visit Link
								</Button>
							)}
						</Stack>
					</Box>
				</Grid>
			</Grid>

			{/* Tags at the bottom */}
			{packageData.tags && packageData.tags.length > 0 && (
				<Box>
					<Box sx={{ mt: 3, mb: 3 }}>
						<Box sx={{ width: '100%', height: '1px', bgcolor: (theme) => alpha(theme.palette.text.primary, 0.1) }} />
					</Box>
					<Box mb={2}>
						<Typography variant="h6" gutterBottom sx={{
							fontWeight: 600,
							fontSize: '1.25rem',
							color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
						}}>Tags</Typography>
						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
							{packageData.tags.map((tag: string) => (
								<Chip
									key={tag}
									label={tag}
									size="medium"
									sx={{
										height: '28px',
										borderRadius: 4,
										bgcolor: (theme) => theme.palette.mode === 'dark'
											? alpha(theme.palette.primary.main, 0.12)
											: alpha(theme.palette.primary.light, 0.12),
										color: (theme) => theme.palette.mode === 'dark'
											? theme.palette.primary.light
											: theme.palette.primary.main,
										fontWeight: 500,
										fontSize: '0.8rem',
										padding: '0 4px',
										'&:hover': {
											bgcolor: (theme) => theme.palette.mode === 'dark'
												? alpha(theme.palette.primary.main, 0.18)
												: alpha(theme.palette.primary.light, 0.18),
										},
										cursor: 'default', // Tags on detail page are not for filtering
									}}
								/>
							))}
						</Box>
					</Box>
				</Box>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={openDeleteConfirm}
				onClose={handleCloseDeleteConfirm}
				aria-labelledby="alert-dialog-title"
				aria-describedby="alert-dialog-description"
			>
				<DialogTitle id="alert-dialog-title">{"Confirm Deletion"}</DialogTitle>
				<DialogContent>
					<DialogContentText id="alert-dialog-description">
						Are you sure you want to delete the package "{packageData?.package_name || packageId}"? This action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseDeleteConfirm} color="primary">
						Cancel
					</Button>
					<Button onClick={handleConfirmDelete} color="error" autoFocus>
						Delete
					</Button>
				</DialogActions>
			</Dialog>
		</Paper>
	);
};

export default PackageDetailPage;