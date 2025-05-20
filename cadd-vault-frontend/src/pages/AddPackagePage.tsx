import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; // Import Supabase client
import { useAuth } from '../context/AuthContext';
import { Package } from '../types';
import {
	Box,
	Typography,
	TextField,
	Button,
	CircularProgress,
	Paper,
	Grid,
	Autocomplete,
	Chip,
} from '@mui/material';

const AddPackagePage: React.FC = () => {
	const navigate = useNavigate();
	const { isAdmin, loading: authLoading } = useAuth();
	const [formData, setFormData] = useState<Partial<Package>>({
		package_name: '',
		description: '',
		publication: '',
		webserver: '',
		repo_link: '', // For code repository
		link: '', // General link
		// github_owner and github_repo will be derived from link if possible
		license: '',
		tags: [],
	});
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [existingTags, setExistingTags] = useState<string[]>([]); // State for existing tags
	const [tagsLoading, setTagsLoading] = useState<boolean>(false); // State for loading tags

	useEffect(() => {
		// Redirect if not admin and auth is not loading
		if (!authLoading && !isAdmin) {
			console.warn('Access denied: User is not an admin.');
			navigate('/'); // Redirect to home page
		}
	}, [isAdmin, authLoading, navigate]);

	// Effect to fetch existing tags
	useEffect(() => {
		const fetchTags = async () => {
			if (!isAdmin) return; // Only fetch if admin
			setTagsLoading(true);
			try {
				const { data, error: fetchError } = await supabase
					.from('packages')
					.select('tags'); // Select only the 'tags' column

				if (fetchError) {
					throw fetchError;
				}

				const allTags = new Set<string>();
				data.forEach((row) => {
					if (row.tags && Array.isArray(row.tags)) {
						row.tags.forEach(tag => allTags.add(tag));
					}
				});
				setExistingTags(Array.from(allTags).sort()); // Sort alphabetically

			} catch (error: any) {
				console.error("Error fetching existing tags:", error.message);
				setError("Failed to load existing tags."); // Inform the user
			} finally {
				setTagsLoading(false);
			}
		};

		if (isAdmin) {
			fetchTags();
		}
	}, [isAdmin]); // Re-run if admin status changes (e.g., after login)

	const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleTagsChange = (_event: React.SyntheticEvent, newValue: string[]) => {
		setFormData((prev) => ({
			...prev,
			tags: newValue,
		}));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!formData.package_name) {
			setError('Package Name (package_name) is required.');
			return;
		}

		setLoading(true);

		try {
			// Prepare data for Supabase insert.
			// Supabase handles timestamps automatically with 'created_at' column.
			// GitHub owner/repo parsing should be handled by a Supabase function/trigger if needed.
			const newPackageData: Omit<Package, 'id' | 'last_commit' | 'github_stars' | 'citations' | 'ratingSum' | 'ratings_count' | 'average_rating' | 'added_at' | 'github_owner' | 'github_repo'> = {
				package_name: formData.package_name || '',
				description: formData.description || '',
				publication: formData.publication || '',
				webserver: formData.webserver || '',
				repo_link: formData.repo_link || '',
				link: formData.link || '',
				license: formData.license || '',
				tags: formData.tags || [],
				// Other fields like last_commit, github_stars, citations, ratings
				// should be handled by backend logic (e.g., GitHub webhook, scheduled functions)
			};

			const { data, error: insertError } = await supabase
				.from('packages')
				.insert([newPackageData])
				.select(); // Select the inserted data to get the new ID

			if (insertError) {
				throw insertError;
			}

			// Assuming the insert returns the newly created row with its ID
			const newPackage = data?.[0];

			if (newPackage) {
				console.log('Package added successfully:', newPackage);
				navigate(`/package/${encodeURIComponent(newPackage.id)}`); // Navigate to the new package page
			} else {
				// This case should ideally not happen if select() is used after insert
				setError('Failed to retrieve the newly added package data.');
				console.error('Insert successful but no data returned.');
			}

		} catch (err: any) {
			console.error('Error adding package: ', err.message);
			setError(`Failed to add package: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};

	// Don't render the form until auth state is confirmed
	if (authLoading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

	// If not admin (although useEffect should redirect, this is a safeguard)
	if (!isAdmin) {
		return <Typography color="error" align="center">Access Denied. You must be an admin to add packages.</Typography>;
	}

	return (
		<Paper elevation={3} sx={{ p: 3, m: 2 }}>
			<Typography variant="h4" gutterBottom component="div">
				Add New Package
			</Typography>
			<form onSubmit={handleSubmit}>
				<Grid container spacing={3}>
					{/* Required Field */}
					<Grid item xs={12}>
						<TextField
							id="package_name" // Add id
							label="Package Name (package_name)"
							name="package_name"
							value={formData.package_name}
							onChange={handleChange}
							required
							fullWidth
							variant="outlined"
						/>
					</Grid>

					{/* Optional Fields */}
					<Grid item xs={12}>
						<TextField
							id="description" // Add id
							label="Description"
							name="description"
							value={formData.description}
							onChange={handleChange}
							multiline
							rows={4}
							fullWidth
							variant="outlined"
						/>
					</Grid>
					<Grid item xs={12} sm={6}>
						<TextField
							id="publication" // Add id
							label="Publication URL"
							name="publication"
							value={formData.publication}
							onChange={handleChange}
							fullWidth
							variant="outlined"
							type="url"
						/>
					</Grid>
					<Grid item xs={12} sm={6}>
						<TextField
							id="webserver" // Add id
							label="Webserver/Homepage URL"
							name="webserver"
							value={formData.webserver}
							onChange={handleChange}
							fullWidth
							variant="outlined"
							type="url"
						/>
					</Grid>
					{/* GitHub Owner and Repo fields removed */}
					<Grid item xs={12} sm={6}>
						<TextField
							id="repo_link" // Add id
							label="Code Repository Link (GitHub or other)"
							name="repo_link"
							value={formData.repo_link}
							onChange={handleChange}
							fullWidth
							variant="outlined"
							type="url"
							helperText="Enter the URL for the code repository"
						/>
					</Grid>
					<Grid item xs={12} sm={6}>
						<TextField
							id="link" // Add id
							label="General Link"
							name="link"
							value={formData.link}
							onChange={handleChange}
							fullWidth
							variant="outlined"
							type="url"
							helperText="Any other relevant link (not publication or webserver)"
						/>
					</Grid>
					<Grid item xs={12} sm={6}>
						<TextField
							id="license" // Add id
							label="License"
							name="license"
							value={formData.license}
							onChange={handleChange}
							fullWidth
							variant="outlined"
						/>
					</Grid>
					<Grid item xs={12}>
						<Autocomplete
							multiple
							id="tags-filled"
							options={existingTags}
							loading={tagsLoading} // Show loading indicator in Autocomplete
							value={formData.tags || []}
							onChange={handleTagsChange}
							freeSolo // Allows adding arbitrary tags
							renderTags={(value: readonly string[], getTagProps) =>
								value.map((option: string, index: number) => (
									<Chip variant="outlined" label={option} {...getTagProps({ index })} />
								))
							}
							renderInput={(params) => (
								<TextField
									{...params}
									id="tags-input" // Add id
									name="tags" // Add name
									variant="outlined"
									label="Tags"
									placeholder="Add or select tags"
									InputProps={{
										...params.InputProps,
										endAdornment: (
											<React.Fragment>
												{tagsLoading ? <CircularProgress color="inherit" size={20} /> : null}
												{params.InputProps.endAdornment}
											</React.Fragment>
										),
									}}
								/>
							)}
						/>
					</Grid>

					{/* Submit Button & Error Message */}
					<Grid item xs={12}>
						{error && (
							<Typography color="error" sx={{ mb: 2 }}>
								{error}
							</Typography>
						)}
						<Button
							type="submit"
							variant="contained"
							color="primary"
							disabled={loading}
							startIcon={loading ? <CircularProgress size={20} /> : null}
						>
							{loading ? 'Adding...' : 'Add Package'}
						</Button>
					</Grid>
				</Grid>
			</form>
		</Paper>
	);
};

export default AddPackagePage;