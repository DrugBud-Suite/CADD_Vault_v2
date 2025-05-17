import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const EditPackagePage: React.FC = () => {
	const { packageId: encodedPackageId } = useParams<{ packageId: string }>();
	const packageId = encodedPackageId ? decodeURIComponent(encodedPackageId) : undefined;
	const navigate = useNavigate();
	const { isAdmin, loading: authLoading } = useAuth();
	const [formData, setFormData] = useState<Partial<Package>>({});
	const [initialDataLoaded, setInitialDataLoaded] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false); // For submit action
	const [error, setError] = useState<string | null>(null);
	const [tagInput, setTagInput] = useState<string>('');
	const [existingTags, setExistingTags] = useState<string[]>([]);
	const [tagsLoading, setTagsLoading] = useState<boolean>(false);

	// Fetch existing package data
	const fetchPackageData = useCallback(async () => {
		if (!packageId || !isAdmin) return; // Only fetch if admin and ID exists
		setLoading(true); // Use loading state for fetch as well initially
		setError(null);
		try {
			const { data, error: fetchError } = await supabase
				.from('packages')
				.select('*')
				.eq('id', packageId) // Assuming 'id' is the primary key in Supabase
				.single(); // Expecting a single row

			if (fetchError) {
				throw fetchError;
			}

			if (data) {
				// Supabase returns data directly.
				// Handle potential mismatch between 'repo_link' and 'repository' fields if necessary.
				const processedData = {
					...data,
					// Use repo_link if present, otherwise fallback to repository from Supabase data
					repo_link: data.repo_link || (data as any).repository || '', // Cast to any if 'repository' is not in Package type
				};
				setFormData(processedData as Partial<Package>); // Cast to Partial<Package>
				setInitialDataLoaded(true);
			} else {
				setError('Package not found.');
			}
		} catch (err: any) {
			console.error("Error fetching package for edit:", err.message);
			setError(`Failed to load package data for editing: ${err.message}`);
		} finally {
			setLoading(false);
		}
	}, [packageId, isAdmin]);

	useEffect(() => {
		// Redirect if not admin and auth is not loading
		if (!authLoading && !isAdmin) {
			console.warn('Access denied: User is not an admin.');
			navigate('/'); // Redirect to home page
			return;
		}
		// Fetch data once admin status is confirmed
		if (isAdmin && packageId && !initialDataLoaded) {
			fetchPackageData();
		}
	}, [isAdmin, authLoading, navigate, packageId, initialDataLoaded, fetchPackageData]);

	// Effect to fetch existing tags
	useEffect(() => {
		const fetchTags = async () => {
			if (!isAdmin) return;
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
				// Optionally set an error state for tags specifically if needed
			} finally {
				setTagsLoading(false);
			}
		};

		if (isAdmin) {
			fetchTags();
		}
	}, [isAdmin]);


	const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleTagsChange = (event: React.SyntheticEvent, newValue: string[]) => {
		setFormData((prev) => ({
			...prev,
			tags: newValue,
		}));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!packageId) {
			setError('Package ID is missing.');
			return;
		}
		if (!formData.package_name) {
			setError('Package Name (package_name) is required.');
			return;
		}

		setLoading(true);

		try {
			// Prepare data for Supabase update.
			// Supabase handles timestamps automatically with 'updated_at' column.
			// GitHub owner/repo parsing should be handled by a Supabase function/trigger if needed.
			// Prepare data for Supabase update.
			// Supabase handles timestamps automatically with 'updated_at' column.
			// GitHub owner/repo parsing should be handled by a Supabase function/trigger if needed.
			const updateData: Partial<Package> = {
				...formData,
				// Remove fields that should not be updated directly or are handled by backend
				// These fields are likely managed by backend processes or set on creation.
				// Ensure 'id' is not included in the update payload.
				id: undefined,
			};

			const { error: updateError } = await supabase
				.from('packages')
				.update(updateData)
				.eq('id', packageId); // Update the row with the matching ID

			if (updateError) {
				throw updateError;
			}

			console.log('Package updated successfully');
			navigate(`/package/${encodeURIComponent(packageId)}`); // Navigate back to the detail page

		} catch (err: any) {
			console.error('Error updating package: ', err.message);
			setError(`Failed to update package: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};

	// Show loading indicator while checking auth or fetching data
	if (authLoading || (isAdmin && !initialDataLoaded && !error)) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

	// If not admin (safeguard)
	if (!isAdmin) {
		return <Typography color="error" align="center">Access Denied. You must be an admin to edit packages.</Typography>;
	}

	// If error occurred during fetch
	if (error && !initialDataLoaded) {
		return <Typography color="error" align="center">{error}</Typography>;
	}

	// If admin but data fetch failed or package not found after trying
	if (isAdmin && !initialDataLoaded) {
		return <Typography color="error" align="center">Could not load package data.</Typography>;
	}


	return (
		<Paper elevation={3} sx={{ p: 3, m: 2 }}>
			<Typography variant="h4" gutterBottom component="div">
				Edit Package: {formData.package_name || '...'}
			</Typography>
			<form onSubmit={handleSubmit}>
				<Grid container spacing={3}>
					{/* Required Field */}
					<Grid item xs={12}>
						<TextField
							id="package_name" // Add id
							label="Package Name (package_name)"
							name="package_name"
							value={formData.package_name || ''}
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
							value={formData.description || ''}
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
							value={formData.publication || ''}
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
							value={formData.webserver || ''}
							onChange={handleChange}
							fullWidth
							variant="outlined"
							type="url"
						/>
					</Grid>
					<Grid item xs={12} sm={6}>
						<TextField
							id="repo_link" // Add id
							label="Code Repository Link (GitHub or other)"
							name="repo_link"
							value={formData.repo_link || ''}
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
							value={formData.link || ''}
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
							value={formData.license || ''}
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
							loading={tagsLoading}
							value={formData.tags || []}
							onChange={handleTagsChange}
							freeSolo
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
						{error && !loading && ( // Show submit errors only when not submitting
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
							{loading ? 'Saving...' : 'Save Changes'}
						</Button>
						<Button
							variant="outlined"
							color="secondary"
							onClick={() => navigate(`/package/${encodeURIComponent(packageId || '')}`)} // Go back
							sx={{ ml: 2 }}
							disabled={loading}
						>
							Cancel
						</Button>
					</Grid>
				</Grid>
			</form>
		</Paper>
	);
};

export default EditPackagePage;