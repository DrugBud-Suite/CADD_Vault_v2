// src/pages/SuggestPackagePage.tsx
import React, { useState, useEffect } from 'react'; // Removed unused useCallback
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import {
	Box, Typography, TextField, Button, CircularProgress, Paper, Grid,
	Autocomplete, Chip, Alert, MenuItem, FormControl, InputLabel, Select, SelectChangeEvent, Container
} from '@mui/material';
import { useFilterStore } from '../store/filterStore';

const SuggestPackagePage: React.FC = () => {
	const navigate = useNavigate();
	const { currentUser, loading: authLoading } = useAuth();
	const [formData, setFormData] = useState<{
		package_name: string;
		description: string;
		publication_url: string;
		webserver_url: string;
		repo_url: string;
		link_url: string;
		license: string;
		tags: string[];
		folder: string;
		category: string;
		suggestion_reason: string;
	}>({
		package_name: '',
		description: '',
		publication_url: '',
		webserver_url: '',
		repo_url: '',
		link_url: '',
		license: '',
		tags: [],
		folder: '',
		category: '',
		suggestion_reason: '',
	});
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const allAvailableTags = useFilterStore(state => state.allAvailableTags);

	const [availableFolders, setAvailableFolders] = useState<string[]>([]);
	const [availableCategories, setAvailableCategories] = useState<string[]>([]);

	useEffect(() => {
		if (!authLoading && !currentUser) {
			setError("You must be logged in to suggest a package.");
		} else {
			setError(null);
		}
	}, [currentUser, authLoading, navigate]);

	useEffect(() => {
		const folders = useFilterStore.getState().allAvailableFolders;
		setAvailableFolders(folders);
	}, []);

	useEffect(() => {
		if (formData.folder) {
			const categories = useFilterStore.getState().allAvailableCategories[formData.folder] || [];
			setAvailableCategories(categories);
		} else {
			setAvailableCategories([]);
		}
	}, [formData.folder]);


	const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		if (name === 'folder') {
			setFormData(prev => ({ ...prev, category: '' }));
		}
	};

	const handleSelectChange = (event: SelectChangeEvent<string>) => {
		const { name, value } = event.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		if (name === 'folder') {
			setFormData(prev => ({ ...prev, category: '' }));
		}
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
		setSuccessMessage(null);

		if (!currentUser) {
			setError("You must be logged in to suggest a package.");
			return;
		}
		if (!formData.package_name) {
			setError('Package Name is required.');
			return;
		}

		setLoading(true);

		try {
			// Insert basic suggestion data without normalized fields
			const suggestionData = {
				suggested_by_user_id: currentUser.id,
				package_name: formData.package_name || '',
				description: formData.description || undefined,
				publication_url: formData.publication_url || undefined,
				webserver_url: formData.webserver_url || undefined,
				repo_url: formData.repo_url || undefined,
				link_url: formData.link_url || undefined,
				license: formData.license || undefined,
				suggestion_reason: formData.suggestion_reason || undefined,
			};

			const { data: insertedSuggestion, error: insertError } = await supabase
				.from('package_suggestions')
				.insert([suggestionData])
				.select('id')
				.single();

			if (insertError) {
				throw insertError;
			}

			// Add tags to normalized table if provided
			if (formData.tags && formData.tags.length > 0) {
				const { error: tagsError } = await supabase
					.rpc('update_suggestion_tags', {
						suggestion_uuid: insertedSuggestion.id,
						new_tags: formData.tags
					});

				if (tagsError) {
					throw tagsError;
				}
			}

			// Add folder/category to normalized table if provided
			if (formData.folder && formData.category) {
				const { error: folderCategoryError } = await supabase
					.rpc('update_suggestion_folder_category', {
						suggestion_uuid: insertedSuggestion.id,
						folder_name: formData.folder,
						category_name: formData.category
					});

				if (folderCategoryError) {
					throw folderCategoryError;
				}
			}

			setSuccessMessage('Package suggestion submitted successfully! It will be reviewed by an admin.');
			setFormData({
				package_name: '', description: '', publication_url: '', webserver_url: '',
				repo_url: '', link_url: '', license: '', tags: [], folder: '', category: '',
				suggestion_reason: '',
			});
		} catch (err: any) {
			console.error('Error submitting package suggestion: ', err.message);
			setError(`Failed to submit suggestion: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};


	if (authLoading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

	return (
		<Container maxWidth="md">
			<Paper elevation={3} sx={{
				p: { xs: 2, md: 4 }, mt: 4, mb: 4,
				background: (theme) => theme.palette.mode === 'dark'
					? 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(23,23,23,0.8) 100%)'
					: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
				backdropFilter: 'blur(8px)',
				border: 0,
				overflow: 'hidden',
				borderRadius: 2,
			}}>
				<Typography variant="h4" gutterBottom component="h1" sx={{ textAlign: 'center', mb: 3, color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary }}>
					Suggest a New Package
				</Typography>
				<form onSubmit={handleSubmit}>
					<Grid container spacing={3}>
						<Grid item xs={12}>
							<TextField
								label="Package Name"
								name="package_name"
								value={formData.package_name}
								onChange={handleChange}
								required
								fullWidth
								variant="outlined"
								helperText="The primary name of the software or tool."
							/>
						</Grid>

						<Grid item xs={12}>
							<TextField
								label="Description"
								name="description"
								value={formData.description}
								onChange={handleChange}
								multiline
								rows={3}
								fullWidth
								variant="outlined"
								helperText="A brief summary of what the package does."
							/>
						</Grid>

						<Grid item xs={12} sm={6}>
							<TextField
								label="Publication URL (e.g., DOI link)"
								name="publication_url"
								value={formData.publication_url}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								type="url"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Webserver/Homepage URL"
								name="webserver_url"
								value={formData.webserver_url}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								type="url"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Code Repository URL (e.g., GitHub)"
								name="repo_url"
								value={formData.repo_url}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								type="url"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Other Relevant Link"
								name="link_url"
								value={formData.link_url}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								type="url"
							/>
						</Grid>

						<Grid item xs={12} sm={6}>
							<TextField
								label="License (e.g., MIT, GPL-3.0)"
								name="license"
								value={formData.license}
								onChange={handleChange}
								fullWidth
								variant="outlined"
							/>
						</Grid>

						<Grid item xs={12} sm={6}>
							<FormControl fullWidth variant="outlined">
								<InputLabel id="folder-label">Folder</InputLabel>
								<Select
									labelId="folder-label"
									id="folder"
									name="folder"
									value={formData.folder || ''}
									onChange={handleSelectChange}
									label="Folder"
								>
									<MenuItem value=""><em>None</em></MenuItem>
									{availableFolders.map((folder) => (
										<MenuItem key={folder} value={folder}>{folder}</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>

						<Grid item xs={12} sm={6}>
							<FormControl fullWidth variant="outlined" disabled={!formData.folder}>
								<InputLabel id="category-label">Category</InputLabel>
								<Select
									labelId="category-label"
									id="category"
									name="category"
									value={formData.category || ''}
									onChange={handleSelectChange}
									label="Category"
								>
									<MenuItem value=""><em>None</em></MenuItem>
									{availableCategories.map((cat) => (
										<MenuItem key={cat} value={cat}>{cat}</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>

						<Grid item xs={12}>
							<Autocomplete
								multiple
								id="tags-suggest"
								options={allAvailableTags}
								value={formData.tags || []}
								onChange={handleTagsChange}
								freeSolo
								renderTags={(value: readonly string[], getTagProps) =>
									value.map((option: string, index: number) => {
										const { key, ...otherTagProps } = getTagProps({ index }); // Destructure key
										return <Chip key={key} variant="outlined" label={option} {...otherTagProps} />; // Apply key directly and spread the rest
									})
								}
								renderInput={(params) => (
									<TextField
										{...params}
										variant="outlined"
										label="Tags"
										placeholder="Add or select tags"
										helperText="Keywords to help categorize the package."
									/>
								)}
							/>
						</Grid>

						<Grid item xs={12}>
							<TextField
								label="Reason for Suggestion (Optional)"
								name="suggestion_reason"
								value={formData.suggestion_reason}
								onChange={handleChange}
								multiline
								rows={3}
								fullWidth
								variant="outlined"
								helperText="Why do you think this package should be added?"
							/>
						</Grid>

						<Grid item xs={12}>
							{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
							{successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
							<Button
								type="submit"
								variant="contained"
								color="primary"
								disabled={loading || !currentUser}
								startIcon={loading ? <CircularProgress size={20} /> : null}
								fullWidth
								size="large"
							>
								{loading ? 'Submitting...' : 'Submit Suggestion'}
							</Button>
						</Grid>
					</Grid>
				</form>
			</Paper>
		</Container>
	);
};

export default SuggestPackagePage;
