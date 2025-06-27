import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; // Import Supabase client
import { useAuth } from '../context/AuthContext';
import { Package } from '../types';
import { useFilterStore } from '../store/filterStore'; // Import the filter store
import {
	Box,
	Typography,
	TextField,
	Button,
	CircularProgress,
	Paper,
	Grid,
	Chip,
	Autocomplete,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	SelectChangeEvent,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { v4 as uuidv4 } from 'uuid';

const AddPackagePage: React.FC = () => {
	const navigate = useNavigate();
	const { isAdmin, loading: authLoading } = useAuth();
	const [formData, setFormData] = useState<Partial<Package>>({
		package_name: '',
		description: '',
		publication: '',
		webserver: '',
		repo_link: '',
		link: '',
		license: '',
		tags: [],
		folder1: '',
		category1: '',
	});
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// Get existing tags from the filter store
	const existingTags = useFilterStore((state) => state.allAvailableTags);
	// Use originalPackages.length as a proxy to know if filter store's metadata is loaded
	const isStoreMetadataLoaded = useFilterStore((state) => state.originalPackages.length > 0);
	const [tagsLoading, setTagsLoading] = useState<boolean>(true);

	// Folder and category state
	const [availableFolders, setAvailableFolders] = useState<string[]>([]);
	const [availableCategories, setAvailableCategories] = useState<string[]>([]);


	useEffect(() => {
		if (!authLoading && !isAdmin) {
			console.warn('Access denied: User is not an admin.');
			navigate('/');
		}
	}, [isAdmin, authLoading, navigate]);

	// Effect to manage tagsLoading state based on store
	useEffect(() => {
		if (isAdmin) {
			if (isStoreMetadataLoaded) {
				setTagsLoading(false);
			} else {
				// If store metadata isn't loaded yet, keep showing loading.
				// HomePage is responsible for populating this.
				// If AddPackagePage can be accessed before HomePage,
				// a direct fetch here might be needed as a fallback,
				// but the primary approach is to rely on the store.
				setTagsLoading(true);
			}
		}
	}, [isAdmin, isStoreMetadataLoaded]);

	// Initialize folders and categories from filter store
	useEffect(() => {
		const folders = useFilterStore.getState().allAvailableFolders;
		setAvailableFolders(folders);
	}, []);

	// Update available categories when folder changes
	useEffect(() => {
		if (formData.folder1) {
			const categories = useFilterStore.getState().allAvailableCategories[formData.folder1] || [];
			setAvailableCategories(categories);
		} else {
			setAvailableCategories([]);
		}
	}, [formData.folder1]);


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
		}
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
			// Generate UUID for the new package
			const packageId = uuidv4();
			
			const newPackageData: Partial<Package> = {
				id: packageId,
				package_name: formData.package_name || '',
				description: formData.description || '',
				publication: formData.publication || '',
				webserver: formData.webserver || '',
				repo_link: formData.repo_link || '',
				link: formData.link || '',
				license: formData.license || '',
				tags: formData.tags || [],
				folder1: formData.folder1 || '',
				category1: formData.category1 || '',
				last_updated: new Date().toISOString(), // Add current timestamp
			};

			const { data, error: insertError } = await supabase
				.from('packages')
				.insert([newPackageData])
				.select();

			if (insertError) {
				throw insertError;
			}

			const newPackage = data?.[0];

			if (newPackage) {
				console.log('Package added successfully:', newPackage);
				// Optionally, update the filterStore's originalPackages and derived metadata here
				// or rely on a full refresh/re-fetch if the user navigates back to HomePage.
				// For simplicity, we'll navigate and let HomePage handle its data.
				useFilterStore.getState().setOriginalPackagesAndDeriveMetadata(
					[...useFilterStore.getState().originalPackages, newPackage]
				);
				navigate(`/package/${encodeURIComponent(newPackage.id)}`);
			} else {
				setError('Failed to retrieve the newly added package data.');
				console.error('Insert successful but no data returned.');
			}

		} catch (err) {
			console.error('Error adding package: ', err);
			setError(`Failed to add package: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setLoading(false);
		}
	};

	if (authLoading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

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
					<Grid item xs={12}>
						<TextField
							id="package_name"
							label="Package Name (package_name)"
							name="package_name"
							value={formData.package_name}
							onChange={handleChange}
							required
							fullWidth
							variant="outlined"
						/>
					</Grid>
					<Grid item xs={12}>
						<TextField
							id="description"
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
							id="publication"
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
							id="webserver"
							label="Webserver/Homepage URL"
							name="webserver"
							value={formData.webserver}
							onChange={handleChange}
							fullWidth
							variant="outlined"
							type="url"
						/>
					</Grid>
					<Grid item xs={12} sm={6}>
						<TextField
							id="repo_link"
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
							id="link"
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
							id="license"
							label="License"
							name="license"
							value={formData.license}
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
							id="tags-standard"
							options={existingTags} // Use tags from the store
							loading={tagsLoading} // Show loading indicator if tags are not yet available
							value={formData.tags || []}
							onChange={handleTagsChange}
							freeSolo
							renderTags={(value: readonly string[], getTagProps) =>
								value.map((option: string, index: number) => {
									const { key, ...otherTagProps } = getTagProps({ index });
									return <Chip
										key={key}
										label={option}
										{...otherTagProps}
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
											mr: 0.5,
											mb: 0.5,
											'&:hover': {
												bgcolor: (theme) => theme.palette.mode === 'dark'
													? alpha(theme.palette.primary.main, 0.25)
													: alpha(theme.palette.primary.light, 0.25),
											},
										}}
									/>;
								})
							}
							renderInput={(params) => (
								<TextField
									{...params}
									variant="outlined"
									label="Tags"
									placeholder="Add or select tags"
									helperText="Type to see suggestions or add new tags"
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
							PaperComponent={({ children, ...otherPaperProps }) => (
								<Paper
									{...otherPaperProps}
									sx={{
										boxShadow: 3,
										maxHeight: '200px',
										overflow: 'auto',
									}}
								>
									{children}
								</Paper>
							)}
							ListboxProps={{
								style: {
									display: 'flex',
									flexWrap: 'wrap',
									gap: '4px',
									padding: '4px',
									margin: 0,
									listStyle: 'none',
								}
							}}
							renderOption={(props, option, { selected }) => (
								<li {...props} style={{ margin: 0, padding: 0, width: 'auto', listStyle: 'none' }}>
									<Chip
										label={option}
										size="small"
										variant={selected ? "filled" : "outlined"}
										clickable
										sx={{
											height: '22px',
											borderRadius: 4,
											bgcolor: (theme) => selected
												? (theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.35) : alpha(theme.palette.primary.light, 0.35))
												: (theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.light, 0.15)),
											color: 'primary.main',
											fontWeight: 500,
											fontSize: '0.7rem',
											cursor: 'pointer',
											m: 0.25,
											'&:hover': {
												bgcolor: (theme) => theme.palette.mode === 'dark'
													? alpha(theme.palette.primary.main, 0.25)
													: alpha(theme.palette.primary.light, 0.25),
											},
											display: 'inline-flex',
										}}
									/>
								</li>
							)}
						/>
					</Grid>
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
