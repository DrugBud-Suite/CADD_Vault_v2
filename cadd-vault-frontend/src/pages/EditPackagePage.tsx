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
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	SelectChangeEvent,
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
	const [existingTags, setExistingTags] = useState<string[]>([]);
	const [tagsLoading, setTagsLoading] = useState<boolean>(false);
	
	// Folder and category state
	const [availableFolders, setAvailableFolders] = useState<string[]>([]);
	const [availableCategories, setAvailableCategories] = useState<string[]>([]);

	// Fetch existing package data
	const fetchPackageData = useCallback(async () => {
		if (!packageId || !isAdmin) return;

		setLoading(true);
		setError(null);

		try {
			// Fetch package with all relationships
			const { data, error: fetchError } = await supabase
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

			if (fetchError) throw fetchError;

			if (data) {
				// Transform the data with null safety
				const packageData = {
					...data,
					tags: data.package_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) || [],
					folder1: data.package_folder_categories?.[0]?.folder_categories?.folders?.name || '',
					category1: data.package_folder_categories?.[0]?.folder_categories?.categories?.name || ''
				};

				setFormData(packageData);
				setInitialDataLoaded(true);
			}
		} catch (err: any) {
			console.error("Error fetching package:", err);
			setError(`Failed to load package data: ${err.message}`);
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
				const { data, error } = await supabase
					.from('tags')
					.select('name')
					.order('name');

				if (error) throw error;

				setExistingTags(data?.map(t => t.name) || []);
			} catch (error: any) {
				console.error("Error fetching tags:", error);
			} finally {
				setTagsLoading(false);
			}
		};

		if (isAdmin) {
			fetchTags();
		}
	}, [isAdmin]);

	// Effect to fetch folders and categories
	useEffect(() => {
		const fetchFoldersAndCategories = async () => {
			if (!isAdmin) return;
			try {
				// Get folders
				const { data: foldersData, error: foldersError } = await supabase
					.from('folders')
					.select('name')
					.order('name');

				if (foldersError) throw foldersError;
				setAvailableFolders(foldersData?.map(f => f.name) || []);

				// Get categories for the current folder
				if (formData.folder1) {
					const { data: categoriesData, error: categoriesError } = await supabase
						.from('folder_categories')
						.select(`
							categories!inner(name),
							folders!inner(name)
						`)
						.eq('folders.name', formData.folder1);

					if (categoriesError) throw categoriesError;
					setAvailableCategories(categoriesData?.map((fc: any) => fc.categories.name) || []);
				}
			} catch (error: any) {
				console.error("Error fetching folders/categories:", error);
			}
		};

		if (isAdmin) {
			fetchFoldersAndCategories();
		}
	}, [isAdmin, formData.folder1]);


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

	const handleSelectChange = (event: SelectChangeEvent<string>) => {
		const { name, value } = event.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		if (name === 'folder1') {
			// Reset category when folder changes
			setFormData(prev => ({ ...prev, category1: '' }));
			setAvailableCategories([]);
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!packageId || !formData.package_name) {
			setError('Package ID and name are required.');
			return;
		}

		setLoading(true);

		try {
			// Update basic package info
			const { error: updateError } = await supabase
				.from('packages')
				.update({
					package_name: formData.package_name,
					description: formData.description || null,
					publication: formData.publication || null,
					webserver: formData.webserver || null,
					repo_link: formData.repo_link || null,
					link: formData.link || null,
					license: formData.license || null,
					last_updated: new Date().toISOString(),
					// Update old columns for rollback capability
					tags: formData.tags || [],
					folder1: formData.folder1 || null,
					category1: formData.category1 || null
				})
				.eq('id', packageId);

			if (updateError) throw updateError;

			// Update tags in normalized structure
			const { error: tagsError } = await supabase
				.rpc('update_package_tags', {
					package_uuid: packageId,
					new_tags: formData.tags || []
				});

			if (tagsError) console.error('Error updating tags:', tagsError);

			// Update folder/category in normalized structure
			const { error: fcError } = await supabase
				.rpc('update_package_folder_category', {
					package_uuid: packageId,
					folder_name: formData.folder1 || '',
					category_name: formData.category1 || ''
				});

			if (fcError) console.error('Error updating folder/category:', fcError);

			navigate(`/package/${encodeURIComponent(packageId)}`);
		} catch (err: any) {
			console.error('Error updating package:', err);
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
					<Grid item xs={12} sm={6}>
						<FormControl fullWidth variant="outlined">
							<InputLabel id="folder1-label">Folder</InputLabel>
							<Select
								labelId="folder1-label"
								id="folder1"
								name="folder1"
								value={formData.folder1 || ''}
								onChange={handleSelectChange}
								label="Folder"
							>
								<MenuItem value="">
									<em>None</em>
								</MenuItem>
								{availableFolders.map((folder) => (
									<MenuItem key={folder} value={folder}>
										{folder}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
					<Grid item xs={12} sm={6}>
						<FormControl fullWidth variant="outlined">
							<InputLabel id="category1-label">Category</InputLabel>
							<Select
								labelId="category1-label"
								id="category1"
								name="category1"
								value={formData.category1 || ''}
								onChange={handleSelectChange}
								label="Category"
								disabled={!formData.folder1}
							>
								<MenuItem value="">
									<em>None</em>
								</MenuItem>
								{availableCategories.map((category) => (
									<MenuItem key={category} value={category}>
										{category}
									</MenuItem>
								))}
							</Select>
						</FormControl>
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