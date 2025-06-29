// src/components/EditSuggestionModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { PackageSuggestion } from '../types';
import {
	Button, TextField,
	CircularProgress, Grid, Autocomplete, Chip, Select, MenuItem, FormControl, InputLabel,
	Box,
	alpha,
	IconButton,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import { SelectChangeEvent } from '@mui/material/Select';
import { BaseModal } from './common/BaseModal';
import { useValidation, urlValidators, genericValidators } from '../utils/validation';
import { useFilterStore } from '../store/filterStore';
import { useAuth } from '../context/AuthContext';

interface EditSuggestionModalProps {
	open: boolean;
	onClose: () => void;
	suggestion: PackageSuggestion | null;
	onSaveSuccess: () => void;
	onSaveAndApproveSuccess?: () => void;
	isAdmin: boolean;
}

const EditSuggestionModal: React.FC<EditSuggestionModalProps> = ({
	open,
	onClose,
	suggestion,
	onSaveSuccess,
	onSaveAndApproveSuccess,
	isAdmin
}) => {
	const [formData, setFormData] = useState<Partial<PackageSuggestion>>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [isAddingFolder, setIsAddingFolder] = useState(false);
	const [isAddingCategory, setIsAddingCategory] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [newCategoryName, setNewCategoryName] = useState('');
	const [folderCreationLoading, setFolderCreationLoading] = useState(false);
	const [categoryCreationLoading, setCategoryCreationLoading] = useState(false);

	const { currentUser } = useAuth();

	// Validation schema using new validation utilities
	const validationSchema = {
		package_name: {
			required: true,
			rules: [genericValidators.minLength(1, 'Package name')]
		},
		publication_url: {
			required: false,
			rules: [urlValidators.isValidUrl()]
		},
		webserver_url: {
			required: false,
			rules: [urlValidators.isValidUrl()]
		},
		repo_url: {
			required: false,
			rules: [urlValidators.isValidUrl()]
		},
		link_url: {
			required: false,
			rules: [urlValidators.isValidUrl()]
		}
	};

	const { errors, validate, validateField, clearErrors } = useValidation(validationSchema);

	const allAvailableTags = useFilterStore(state => state.allAvailableTags);
	const allAvailableFolders = useFilterStore(state => state.allAvailableFolders);
	const allAvailableCategoriesMap = useFilterStore(state => state.allAvailableCategories);

	const [currentCategories, setCurrentCategories] = useState<string[]>([]);

	useEffect(() => {
		if (suggestion) {
			const initialFormData: Partial<PackageSuggestion> = {
				package_name: suggestion.package_name || '',
				description: suggestion.description || '',
				publication_url: suggestion.publication_url || '',
				webserver_url: suggestion.webserver_url || '',
				repo_url: suggestion.repo_url || '',
				link_url: suggestion.link_url || '',
				license: suggestion.license || '',
				tags: suggestion.tags || [],
				folder1: suggestion.folder1 || '',
				category1: suggestion.category1 || '',
				suggestion_reason: suggestion.suggestion_reason || '',
				admin_notes: isAdmin ? (suggestion.admin_notes || '') : undefined,
			};

			// Auto-suggest tags from description if no tags are present
			if ((!suggestion.tags || suggestion.tags.length === 0) && suggestion.description) {
				const descriptionWords = suggestion.description
					.toLowerCase()
					.replace(/[^\w\s]/gi, '') // Remove punctuation
					.split(/\s+/) // Split into words
					.filter(word => word.length > 2); // Filter out very short words

				const uniqueDescriptionWords = Array.from(new Set(descriptionWords));

				const suggestedTagsFromDescription = uniqueDescriptionWords.filter(word =>
					allAvailableTags.includes(word)
				);

				if (suggestedTagsFromDescription.length > 0) {
					initialFormData.tags = suggestedTagsFromDescription;
				}
			}

			setFormData(initialFormData);

			if (suggestion.folder1 && allAvailableCategoriesMap[suggestion.folder1]) {
				setCurrentCategories(allAvailableCategoriesMap[suggestion.folder1]);
			} else {
				setCurrentCategories([]);
			}
		} else {
			setFormData({});
			setCurrentCategories([]);
		}
		setError(null);
		setSuccessMessage(null);
		setIsAddingFolder(false);
		setIsAddingCategory(false);
		setNewFolderName('');
		setNewCategoryName('');
		clearErrors(); // Clear validation errors when modal opens
	}, [suggestion, isAdmin, open, allAvailableCategoriesMap, allAvailableTags, clearErrors]);

	useEffect(() => {
		if (formData.folder1 && allAvailableCategoriesMap[formData.folder1]) {
			setCurrentCategories(allAvailableCategoriesMap[formData.folder1]);
		} else {
			setCurrentCategories([]);
		}
		// Reset category if the current category is not valid for the selected folder
		if (formData.folder1 && !allAvailableCategoriesMap[formData.folder1]?.includes(formData.category1 || '')) {
			setFormData(prev => ({ ...prev, category1: '' }));
		}
	}, [formData.folder1, allAvailableCategoriesMap, formData.category1]);


	const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setFormData(prev => ({ ...prev, [name as string]: value }));
		
		// Validate field if it has validation rules
		if (validationSchema[name as keyof typeof validationSchema]) {
			validateField(name, value);
		}
		
		if (name === 'folder1') {
			setFormData(prev => ({ ...prev, category1: '' })); // Reset category when folder changes
		}
	};

	const handleTagChange = (_event: React.SyntheticEvent, newValue: string[]) => {
		setFormData(prev => ({ ...prev, tags: newValue }));
	};

	const handleSelectChange = (event: SelectChangeEvent<string>, fieldName: 'folder1' | 'category1') => {
		const { value } = event.target;

		if (value === "__add_new__" && fieldName === 'folder1') {
			setIsAddingFolder(true);
			return;
		} else if (value === "__add_new__" && fieldName === 'category1') {
			setIsAddingCategory(true);
			return;
		}

		setFormData(prev => ({ ...prev, [fieldName]: value }));
		if (fieldName === 'folder1') {
			setFormData(prev => ({ ...prev, category1: '' })); // Reset category when folder changes
			if (value && allAvailableCategoriesMap[value]) {
				setCurrentCategories(allAvailableCategoriesMap[value]);
			} else {
				setCurrentCategories([]);
			}
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!suggestion) {
			setError("No suggestion selected for editing.");
			return;
		}
		
		// Validate form using new validation utilities
		if (!validate(formData)) {
			setError("Please correct the validation errors before submitting.");
			return;
		}
		
		setLoading(true);
		setError(null);
		setSuccessMessage(null);

		const updates: Partial<Omit<PackageSuggestion, 'id' | 'created_at' | 'status' | 'suggested_by_user_id' | 'reviewed_at' | 'reviewed_by_admin_id' | 'suggester_email'>> = {
			package_name: formData.package_name,
			description: formData.description || undefined,
			publication_url: formData.publication_url || undefined,
			webserver_url: formData.webserver_url || undefined,
			repo_url: formData.repo_url || undefined,
			link_url: formData.link_url || undefined,
			license: formData.license || undefined,
			tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
			folder1: formData.folder1 || undefined,
			category1: formData.category1 || undefined,
			suggestion_reason: formData.suggestion_reason || undefined,
		};

		if (isAdmin) {
			updates.admin_notes = formData.admin_notes || undefined;
		}

		try {
			const { error: updateError } = await supabase
				.from('package_suggestions')
				.update(updates)
				.eq('id', suggestion.id);

			if (updateError) {
				console.error("Supabase update error:", updateError);
				throw updateError;
			}

			setSuccessMessage("Suggestion updated successfully!");
			setLoading(false);
			onSaveSuccess(); // Callback to refresh parent component's data
		} catch (err: any) {
			console.error("Error in handleSubmit:", err);
			setError(err.message || "Failed to update suggestion.");
			setLoading(false);
		}
	};
	const handleSaveAndApprove = async () => {
		if (!suggestion || !currentUser || !isAdmin || !formData.package_name?.trim()) {
			setError("Invalid operation.");
			return;
		}

		setLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			// First update the suggestion
			const suggestionUpdates = {
				package_name: formData.package_name,
				description: formData.description || null,
				publication_url: formData.publication_url || null,
				webserver_url: formData.webserver_url || null,
				repo_url: formData.repo_url || null,
				link_url: formData.link_url || null,
				license: formData.license || null,
				tags: formData.tags && formData.tags.length > 0 ? formData.tags : null,
				folder1: formData.folder1 || null,
				category1: formData.category1 || null,
				suggestion_reason: formData.suggestion_reason || null,
				admin_notes: formData.admin_notes || null
			};

			const { error: saveError } = await supabase
				.from('package_suggestions')
				.update(suggestionUpdates)
				.eq('id', suggestion.id);

			if (saveError) throw saveError;

			// Then approve using the database function
			const { error: approveError } = await supabase
				.rpc('approve_suggestion_with_normalized_data', {
					suggestion_id: suggestion.id,
					approved_by: currentUser.id
				});

			if (approveError) throw approveError;

			setSuccessMessage("Suggestion approved and package created successfully!");
			if (onSaveAndApproveSuccess) {
				onSaveAndApproveSuccess();
			} else {
				onSaveSuccess(); // Use the existing callback
			}
			onClose();
		} catch (err: any) {
			console.error("Error in save and approve:", err);
			setError(`Failed to save and approve: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};
	const handleCreateFolder = async () => {
		if (!isAdmin) {
			setError("You must be an admin to create new folders.");
			return;
		}

		if (!newFolderName.trim()) {
			setError("Please enter a folder name.");
			return;
		}

		setFolderCreationLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			// Create folder in normalized table
			const { error: insertError } = await supabase
				.from('folders')
				.insert({ name: newFolderName.trim() })
				.select()
				.single();

			if (insertError) {
				if (insertError.code === '23505') {
				setError(`Folder "${newFolderName.trim()}" already exists.`);
				} else {
					throw insertError;
				}
				return;
			}

			// Update local state
			const updatedFolders = [...allAvailableFolders, newFolderName.trim()].sort();
			useFilterStore.setState({
				allAvailableFolders: updatedFolders,
				allAvailableCategories: {
				...allAvailableCategoriesMap,
				[newFolderName.trim()]: []
				}
			});

			setFormData(prev => ({
				...prev,
				folder1: newFolderName.trim(),
				category1: ''
			}));

			setNewFolderName('');
			setIsAddingFolder(false);
			setSuccessMessage(`Folder "${newFolderName.trim()}" created successfully.`);

			// Refresh metadata
			await useFilterStore.getState().refreshMetadata();

		} catch (err: any) {
			console.error("Error creating folder:", err);
			setError(`Failed to create folder: ${err.message}`);
		} finally {
			setFolderCreationLoading(false);
		}
	};

	// Update handleCreateCategory to use normalized structure
	const handleCreateCategory = async () => {
		if (!isAdmin || !formData.folder1 || !newCategoryName.trim()) {
			setError("Please select a folder and enter a category name.");
			return;
		}

		setCategoryCreationLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			// Use database function to ensure relationship
			const { error } = await supabase
				.rpc('ensure_folder_category_exists', {
					folder_name: formData.folder1,
					category_name: newCategoryName.trim()
				});

			if (error) throw error;

			// Update local state
			const currentCats = allAvailableCategoriesMap[formData.folder1] || [];
			if (!currentCats.includes(newCategoryName.trim())) {
			const updatedCategories = {
				...allAvailableCategoriesMap,
				[formData.folder1]: [...currentCats, newCategoryName.trim()].sort()
			};

				useFilterStore.setState({
					allAvailableCategories: updatedCategories
				});

				setCurrentCategories(updatedCategories[formData.folder1]);
			}

			setFormData(prev => ({
				...prev,
				category1: newCategoryName.trim()
			}));

			setNewCategoryName('');
			setIsAddingCategory(false);
			setSuccessMessage(`Category "${newCategoryName.trim()}" created successfully.`);

			// Refresh metadata
			await useFilterStore.getState().refreshMetadata();

		} catch (err: any) {
			console.error("Error creating category:", err);
			setError(`Failed to create category: ${err.message}`);
		} finally {
			setCategoryCreationLoading(false);
		}
	};


	if (!suggestion) return null;

	return (
		<BaseModal
			open={open}
			onClose={onClose}
			title="Edit Suggestion"
			subtitle={suggestion.package_name}
			loading={loading}
			error={error}
			success={successMessage}
			maxWidth="md"
			actions={
				<>
					<Button onClick={onClose} color="inherit" variant="outlined">
						Cancel
					</Button>
					<Button 
						onClick={handleSubmit} 
						variant="contained" 
						color="primary" 
						disabled={loading || (suggestion?.status !== 'pending' && !isAdmin) || Object.keys(errors).length > 0}
					>
						Save Changes
					</Button>
					{isAdmin && suggestion?.status === 'pending' && (
						<Button
							variant="contained"
							color="success"
							onClick={handleSaveAndApprove}
							disabled={loading || Object.keys(errors).length > 0}
							sx={{ ml: 1 }}
						>
							Save & Approve & Add to DB
						</Button>
					)}
				</>
			}
		>
			<form onSubmit={handleSubmit}>
					<Grid container spacing={2.5}>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Package Name"
								name="package_name"
								value={formData.package_name || ''}
								onChange={handleChange}
								fullWidth
								required
								variant="outlined"
								size="small"
								error={!!errors.package_name}
								helperText={errors.package_name}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="License"
								name="license"
								value={formData.license || ''}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								size="small"
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								label="Description"
								name="description"
								value={formData.description || ''}
								onChange={handleChange}
								multiline
								rows={3}
								fullWidth
								variant="outlined"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Publication URL"
								name="publication_url"
								type="url"
								value={formData.publication_url || ''}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								size="small"
								error={!!errors.publication_url}
								helperText={errors.publication_url}
								InputProps={{
									endAdornment: formData.publication_url && (
										<IconButton
											aria-label="open publication url in new tab"
											onClick={() => window.open(formData.publication_url, '_blank', 'noopener,noreferrer')}
											edge="end"
										>
											<OpenInNewIcon />
										</IconButton>
									),
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Webserver URL"
								name="webserver_url"
								type="url"
								value={formData.webserver_url || ''}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								size="small"
								error={!!errors.webserver_url}
								helperText={errors.webserver_url}
								InputProps={{
									endAdornment: formData.webserver_url && (
										<IconButton
											aria-label="open webserver url in new tab"
											onClick={() => window.open(formData.webserver_url, '_blank', 'noopener,noreferrer')}
											edge="end"
										>
											<OpenInNewIcon />
										</IconButton>
									),
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Repository URL"
								name="repo_url"
								type="url"
								value={formData.repo_url || ''}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								size="small"
								error={!!errors.repo_url}
								helperText={errors.repo_url}
								InputProps={{
									endAdornment: formData.repo_url && (
										<IconButton
											aria-label="open repository url in new tab"
											onClick={() => window.open(formData.repo_url, '_blank', 'noopener,noreferrer')}
											edge="end"
										>
											<OpenInNewIcon />
										</IconButton>
									),
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Other Link URL"
								name="link_url"
								type="url"
								value={formData.link_url || ''}
								onChange={handleChange}
								fullWidth
								variant="outlined"
								size="small"
								error={!!errors.link_url}
								helperText={errors.link_url}
								InputProps={{
									endAdornment: formData.link_url && (
										<IconButton
											aria-label="open other link url in new tab"
											onClick={() => window.open(formData.link_url, '_blank', 'noopener,noreferrer')}
											edge="end"
										>
											<OpenInNewIcon />
										</IconButton>
									),
								}}
							/>
						</Grid>
						<Grid item xs={12}>
							<Autocomplete
								multiple
								id="tags-edit-suggestion"
								options={allAvailableTags}
								value={formData.tags || []}
								onChange={handleTagChange}
								freeSolo
								disablePortal
								disableCloseOnSelect
								limitTags={5}
								renderTags={(value, getTagProps) =>
									value.map((option, index) => {
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
									<TextField {...params} variant="outlined" label="Tags" placeholder="Add or select tags" size="small" />
								)}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControl fullWidth variant="outlined" size="small">
								<InputLabel id="folder1-edit-label">Folder</InputLabel>
								<Select
									labelId="folder1-edit-label"
									id="folder1-edit"
									name="folder1"
									value={formData.folder1 || ''}
									onChange={(e) => handleSelectChange(e as SelectChangeEvent<string>, 'folder1')}
									label="Folder"
								>
									<MenuItem value=""><em>None</em></MenuItem>
									{allAvailableFolders.map((folder) => (
										<MenuItem key={folder} value={folder}>{folder}</MenuItem>
									))}
									{isAdmin && (
										<MenuItem value="__add_new__" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
											<AddIcon fontSize="small" sx={{ mr: 1 }} /> Add New Folder
										</MenuItem>
									)}
								</Select>
							</FormControl>
							{isAddingFolder && isAdmin && (
								<Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
									<TextField
										size="small"
										placeholder="Enter new folder name"
										value={newFolderName}
										onChange={(e) => setNewFolderName(e.target.value)}
										sx={{ flexGrow: 1 }}
										autoFocus
									/>
									<Button
										size="small"
										variant="contained"
										onClick={handleCreateFolder}
										sx={{ ml: 1 }}
										disabled={folderCreationLoading || !newFolderName.trim()}
									>
										{folderCreationLoading ? <CircularProgress size={20} /> : "Create"}
									</Button>
									<Button
										size="small"
										onClick={() => setIsAddingFolder(false)}
										sx={{ ml: 1 }}
										disabled={folderCreationLoading}
									>
										Cancel
									</Button>
								</Box>
							)}
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControl fullWidth variant="outlined" size="small" disabled={!formData.folder1}>
								<InputLabel id="category1-edit-label">Category</InputLabel>
								<Select
									labelId="category1-edit-label"
									id="category1-edit"
									name="category1"
									value={formData.category1 || ''}
									onChange={(e) => handleSelectChange(e as SelectChangeEvent<string>, 'category1')}
									label="Category"
								>
									<MenuItem value=""><em>None</em></MenuItem>
									{currentCategories.map((category) => (
										<MenuItem key={category} value={category}>{category}</MenuItem>
									))}
									{isAdmin && formData.folder1 && (
										<MenuItem value="__add_new__" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
											<AddIcon fontSize="small" sx={{ mr: 1 }} /> Add New Category
										</MenuItem>
									)}
								</Select>
							</FormControl>
							{isAddingCategory && isAdmin && (
								<Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
									<TextField
										size="small"
										placeholder="Enter new category name"
										value={newCategoryName}
										onChange={(e) => setNewCategoryName(e.target.value)}
										sx={{ flexGrow: 1 }}
										autoFocus
									/>
									<Button
										size="small"
										variant="contained"
										onClick={handleCreateCategory}
										sx={{ ml: 1 }}
										disabled={categoryCreationLoading || !newCategoryName.trim()}
									>
										{categoryCreationLoading ? <CircularProgress size={20} /> : "Create"}
									</Button>
									<Button
										size="small"
										onClick={() => setIsAddingCategory(false)}
										sx={{ ml: 1 }}
										disabled={categoryCreationLoading}
									>
										Cancel
									</Button>
								</Box>
							)}
						</Grid>
						<Grid item xs={12}>
							<TextField
								label="Reason for Suggestion"
								name="suggestion_reason"
								value={formData.suggestion_reason || ''}
								onChange={handleChange}
								multiline
								rows={3}
								fullWidth
								variant="outlined"
								disabled={!isAdmin && suggestion?.status !== 'pending'} // User can only edit reason if pending
							/>
						</Grid>
						{isAdmin && (
							<Grid item xs={12}>
								<TextField
									label="Admin Notes"
									name="admin_notes"
									value={formData.admin_notes || ''}
									onChange={handleChange}
									multiline
									rows={3}
									fullWidth
									variant="outlined"
								/>
							</Grid>
						)}
					</Grid>
			</form>
		</BaseModal>
	);
};

export default EditSuggestionModal;
