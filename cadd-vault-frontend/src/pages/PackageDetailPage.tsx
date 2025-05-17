
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; // Import Supabase client
import { useAuth } from '../context/AuthContext';
import { Package } from '../types'; // Assuming Package type definition
import { Box, Typography, CircularProgress, Link, Paper, Grid, Chip, Button } from '@mui/material';
import { StarBorder, Commit, Description, Link as LinkIcon, Gavel, MenuBook, Edit } from '@mui/icons-material'; // Example icons
import RatingInput from '../components/RatingInput'; // Import RatingInput

const PackageDetailPage: React.FC = () => {
	const { packageId: encodedPackageId } = useParams<{ packageId: string }>();
	const navigate = useNavigate();
	const { isAdmin } = useAuth(); // Get admin status
	const packageId = encodedPackageId ? decodeURIComponent(encodedPackageId) : undefined;
	const [packageData, setPackageData] = useState<Package | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const handleEditClick = () => {
		if (packageId) {
			// Navigate to the edit page (route needs to be defined later)
			navigate(`/edit-package/${encodeURIComponent(packageId)}`);
		}
	};

	useEffect(() => {
		const fetchPackage = async () => {
			if (!packageId) {
				setError('Package ID is missing.');
				setLoading(false);
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const { data, error: dbError } = await supabase
					.from('packages')
					.select('*')
					.eq('id', packageId) // Assuming 'id' is the primary key in Supabase
					.single(); // Expecting a single row

				if (dbError) {
					throw dbError;
				}

				if (data) {
					setPackageData(data as Package); // Supabase returns data directly
				} else {
					setError('Package not found.');
				}
			} catch (err: any) {
				console.error("Error fetching package:", err);
				setError(`Failed to fetch package data: ${err?.message || 'Unknown error'}`);
			} finally {
				setLoading(false);
			}
		};

		fetchPackage();
	}, [packageId]);

	if (loading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

	if (error) {
		return <Typography color="error" align="center">{error}</Typography>;
	}

	if (!packageData) {
		return <Typography align="center">Package data is not available.</Typography>;
	}

	// Helper to format date
	const formatDate = (date: string | Date | null | undefined) => {
		if (!date) return 'N/A';
		try {
			const d = date instanceof Date ? date : new Date(date);
			if (isNaN(d.getTime())) return 'N/A';
			return d.toLocaleDateString(); // Or more specific formatting
		} catch {
			return 'N/A';
		}
	};

	// Helper to calculate time ago
	const timeAgo = (date: string | Date | null | undefined): string => {
		if (!date) return 'N/A';
		// Use pre-calculated string if available (assuming Supabase might provide this)
		// if (packageData?.last_commit_ago) return packageData.last_commit_ago; // Remove if not provided by Supabase

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


	return (
		<Paper elevation={3} sx={{ p: 3, m: 2, position: 'relative' }}>
			{isAdmin && (
				<Button
					variant="contained"
					color="secondary"
					startIcon={<Edit />}
					onClick={handleEditClick}
					sx={{ position: 'absolute', top: 16, right: 16 }}
				>
					Edit
				</Button>
			)}
			<Typography variant="h4" gutterBottom component="div" sx={{ pr: isAdmin ? '100px' : 0 }}>
				{packageData.package_name || 'Unnamed Package'}
			</Typography>

			{/* Description without header */}
			<Box mb={3}>
				<Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
					{packageData.description || 'No description available.'}
				</Typography>
			</Box>

			<Grid container spacing={4} mb={3}>
				{/* Code Section */}
				<Grid item xs={12} md={4}>
					<Typography variant="h6" gutterBottom>Code</Typography>
					{/* Repository Link */}
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">Repository</Typography>
						{packageData.repository ? (
							<Link href={packageData.repository} target="_blank" rel="noopener noreferrer">
								{packageData.repository}
							</Link>
						) : (packageData.github_owner && packageData.github_repo) ? (
							<Link href={`https://github.com/${packageData.github_owner}/${packageData.github_repo}`}
								target="_blank" rel="noopener noreferrer">
								{packageData.github_owner}/{packageData.github_repo}
							</Link>
						) : packageData.repo_link ? (
							<Link href={packageData.repo_link} target="_blank" rel="noopener noreferrer">
								{packageData.repo_link}
							</Link>
						) : (
							<Typography variant="body2">N/A</Typography>
						)}
					</Box>
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">
							<StarBorder sx={{ verticalAlign: 'middle', mr: 1, fontSize: '1rem' }} />
							Stars
						</Typography>
						<Typography variant="body2">{packageData.github_stars ?? 'N/A'}</Typography>
					</Box>
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">
							<Commit sx={{ verticalAlign: 'middle', mr: 1, fontSize: '1rem' }} />
							Last Commit
						</Typography>
						<Typography variant="body2">
							{formatDate(packageData.last_commit)} ({timeAgo(packageData.last_commit)})
						</Typography>
					</Box>
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">
							<Gavel sx={{ verticalAlign: 'middle', mr: 1, fontSize: '1rem' }} />
							License
						</Typography>
						<Typography variant="body2">{packageData.license || 'N/A'}</Typography>
					</Box>
				</Grid>

				{/* Publication Section */}
				<Grid item xs={12} md={4}>
					<Typography variant="h6" gutterBottom>Publication</Typography>
					{/* Publication Link */}
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">Publication</Typography>
						{packageData.publication ? (
							<Link href={packageData.publication} target="_blank" rel="noopener noreferrer">
								{packageData.publication}
							</Link>
						) : (
							<Typography variant="body2">N/A</Typography>
						)}
					</Box>
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">Citations</Typography>
						<Typography variant="body2">{packageData.citations ?? 'N/A'}</Typography>
					</Box>
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">Journal</Typography>
						<Typography variant="body2">{packageData.journal || 'N/A'}</Typography>
					</Box>
					<Box mb={2}>
						<Typography variant="subtitle1" fontWeight="bold">Impact Factor</Typography>
						<Typography variant="body2">{packageData.jif ? packageData.jif.toFixed(2) : 'N/A'}</Typography>
					</Box>
				</Grid>

				{/* Other Section */}
				<Grid item xs={12} md={4}>
					<Typography variant="h6" gutterBottom>Other</Typography>
					{/* Webserver */}
					{packageData.webserver && (
						<Box mb={2}>
							<Typography variant="subtitle1" fontWeight="bold">Webserver/Homepage</Typography>
							<Link href={packageData.webserver} target="_blank" rel="noopener noreferrer">
								{packageData.webserver}
							</Link>
						</Box>
					)}
					{/* General Link */}
					{packageData.link && (
						<Box mb={2}>
							<Typography variant="subtitle1" fontWeight="bold">Link</Typography>
							<Link href={packageData.link} target="_blank" rel="noopener noreferrer">
								{packageData.link}
							</Link>
						</Box>
					)}
					{/* Version if available */}
					{packageData.version && (
						<Box mb={2}>
							<Typography variant="subtitle1" fontWeight="bold">Version</Typography>
							<Typography variant="body2">{packageData.version}</Typography>
						</Box>
					)}
					{/* Name if available and different from package_name */}
					{packageData.name && packageData.name !== packageData.package_name && (
						<Box mb={2}>
							<Typography variant="subtitle1" fontWeight="bold">Package Name</Typography>
							<Typography variant="body2">{packageData.name}</Typography>
						</Box>
					)}
				</Grid>
			</Grid>

			{/* Rating Input */}
			{packageId && (
				<RatingInput
					packageId={packageId}
					initialAverageRating={packageData.average_rating ?? 0}
					initialRatingsCount={packageData.ratings_count ?? 0}
				/>
			)}

			{/* Tags at the bottom */}
			{packageData.tags && packageData.tags.length > 0 && (
				<Box mb={2}>
					<Typography variant="h6" gutterBottom>Tags</Typography>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
						{packageData.tags.map((tag: string) => (
							<Chip key={tag} label={tag} size="small" />
						))}
					</Box>
				</Box>
			)}
		</Paper>
	);
};

export default PackageDetailPage;