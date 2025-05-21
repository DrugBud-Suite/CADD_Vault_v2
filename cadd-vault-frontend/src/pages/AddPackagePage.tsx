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
} from '@mui/material';
import { alpha } from '@mui/material/styles';

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
	});
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// Get existing tags from the filter store
	const existingTags = useFilterStore((state) => state.allAvailableTags);
	// Use originalPackages.length as a proxy to know if filter store's metadata is loaded
	const isStoreMetadataLoaded = useFilterStore((state) => state.originalPackages.length > 0);
	const [tagsLoading, setTagsLoading] = useState<boolean>(true);


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
			const newPackageData: Omit<Package, 'id' | 'last_commit' | 'github_stars' | 'citations' | 'average_rating' | 'ratings_count' | 'added_at' | 'github_owner' | 'github_repo'> = {
				package_name: formData.package_name || '',
				description: formData.description || '',
				publication: formData.publication || '',
				webserver: formData.webserver || '',
				repo_link: formData.repo_link || '',
				link: formData.link || '',
				license: formData.license || '',
				tags: formData.tags || [],
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

		} catch (err: any) {
			console.error('Error adding package: ', err.message);
			setError(`Failed to add package: ${err.message}`);
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
