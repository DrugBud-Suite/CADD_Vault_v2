// src/components/EditSuggestionModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { PackageSuggestion, Package as PackageType } from '../types'; // Import PackageType
import {
	Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
	CircularProgress, Alert, Grid, Autocomplete, Chip, Select, MenuItem, FormControl, InputLabel,
	Box,
	alpha,
	IconButton,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import { SelectChangeEvent } from '@mui/material/Select';
import { useFilterStore } from '../store/filterStore';
import { useAuth } from '../context/AuthContext';

interface EditSuggestionModalProps {
	open: boolean;
	onClose: () => void;
	suggestion: PackageSuggestion | null;
	onSaveSuccess: () => void;
	isAdmin: boolean;
}

const EditSuggestionModal: React.FC<EditSuggestionModalProps> = ({
	open,
	onClose,
	suggestion,
	onSaveSuccess,
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
	}, [suggestion, isAdmin, open, allAvailableCategoriesMap, allAvailableTags]);

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
		if (!formData.package_name?.trim()) {
			setError("Package name is required.");
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
		if (!suggestion || !currentUser || !isAdmin) {
			setError("Action not allowed or user not identified.");
			return;
		}
		if (!formData.package_name?.trim()) {
			setError("Package name is required.");
			return;
		}
		setLoading(true);
		setError(null);
		setSuccessMessage(null);

		// First, save the suggestion details
		const suggestionUpdates: Partial<Omit<PackageSuggestion, 'id' | 'created_at' | 'status' | 'suggested_by_user_id' | 'reviewed_at' | 'reviewed_by_admin_id' | 'suggester_email'>> = {
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
			admin_notes: formData.admin_notes || undefined,
		};

		try {
			const { error: saveError } = await supabase
				.from('package_suggestions')
				.update(suggestionUpdates)
				.eq('id', suggestion.id);

			if (saveError) {
				console.error("Error saving suggestion details:", saveError);
				throw new Error(`Failed to save suggestion details: ${saveError.message}`);
			}

			// Then, approve the suggestion
			const approvalData = {
				status: 'approved',
				reviewed_at: new Date().toISOString(),
				reviewed_by_admin_id: currentUser.id,
			};
			const { error: approveError } = await supabase
				.from('package_suggestions')
				.update(approvalData)
				.eq('id', suggestion.id);

			if (approveError) {
				console.error("Error approving suggestion:", approveError);
				throw new Error(`Suggestion saved, but failed to approve: ${approveError.message}`);
			}

			// Finally, create the package in the 'packages' table
			// Ensure this object matches the 'packages' table schema from supabase_setup.txt
			// and the PackageType from types.ts, omitting fields handled by DB or not applicable.
			const newPackageDataForTable: Omit<PackageType, 'id' | 'average_rating' | 'ratings_count' | 'last_commit_ago' | 'github_stars' | 'citations' | 'jif' | 'journal' | 'last_commit' | 'page_icon' | 'primary_language' | 'github_owner' | 'github_repo' | 'name' | 'version' | 'repository' | 'subcategory1' | 'subsubcategory1'> = {
				package_name: formData.package_name!, // This is required
				description: formData.description || undefined,
				publication: formData.publication_url || undefined, // Maps to 'publication'
				webserver: formData.webserver_url || undefined,     // Maps to 'webserver'
				repo_link: formData.repo_url || undefined,         // Maps to 'repo_link'
				link: formData.link_url || undefined,              // Maps to 'link'
				license: formData.license || undefined,
				tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
				folder1: formData.folder1 || undefined,
				category1: formData.category1 || undefined,
			// Omitting: average_rating, ratings_count (handled by triggers)
			// Omitting: github_stars, last_commit, citations, jif, journal etc. (populated by backend scripts)
			};


			const { error: createPackageError } = await supabase
				.from('packages')
				.insert([newPackageDataForTable]);

			if (createPackageError) {
				console.error("Error creating package from suggestion:", createPackageError);
				// Potentially roll back suggestion approval or mark it for retry
				throw new Error(`Suggestion approved, but failed to create package: ${createPackageError.message}`);
			}

			setSuccessMessage("Suggestion saved, approved, and package created successfully!");
			onSaveSuccess(); // Callback to refresh parent component's data

		} catch (err: any) {
			console.error("Error in handleSaveAndApprove:", err);
			setError(err.message || "An unexpected error occurred during the save and approve process.");
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
			// Check if folder already exists
			if (allAvailableFolders.includes(newFolderName.trim())) {
				setError(`Folder "${newFolderName.trim()}" already exists.`);
				setFolderCreationLoading(false);
				return;
			}

			// Get existing folders to check if folder already exists in any package
			const { data: existingData, error: existingError } = await supabase
				.from('packages')
				.select('folder1')
				.eq('folder1', newFolderName.trim())
				.limit(1);

			if (existingError) throw existingError;

			if (existingData && existingData.length > 0) {
				setError(`Folder "${newFolderName.trim()}" already exists in the database.`);
				setFolderCreationLoading(false);
				return;
			}

			// Create a placeholder package with the new folder to establish it in the database
			const { error: insertError } = await supabase
				.from('packages')
				.insert({
					package_name: `__folder_placeholder_${Date.now()}`,
					folder1: newFolderName.trim(),
					description: `This is a placeholder entry to establish the folder "${newFolderName.trim()}". This entry can be safely deleted once other packages use this folder.`
				});

			if (insertError) throw insertError;

			// Update the folders list in the filter store
			const updatedFolders = [...allAvailableFolders, newFolderName.trim()].sort();
			const updatedCategories = {
				...allAvailableCategoriesMap,
				[newFolderName.trim()]: []
			};

			// Reset the form
			setNewFolderName('');
			setIsAddingFolder(false);
			setSuccessMessage(`Folder "${newFolderName.trim()}" has been created successfully.`);

			// Update the store with the new folder
			useFilterStore.setState({
				allAvailableFolders: updatedFolders,
				allAvailableCategories: updatedCategories
			});

			// Set the newly created folder as the selected folder
			setFormData(prev => ({ ...prev, folder1: newFolderName.trim(), category1: '' }));

		} catch (err: any) {
			console.error("Error creating folder:", err);
			setError(`Failed to create folder: ${err.message}`);
		} finally {
			setFolderCreationLoading(false);
		}
	};

	const handleCreateCategory = async () => {
		if (!isAdmin) {
			setError("You must be an admin to create new categories.");
			return;
		}

		if (!formData.folder1) {
			setError("Please select a folder first.");
			return;
		}

		if (!newCategoryName.trim()) {
			setError("Please enter a category name.");
			return;
		}

		setCategoryCreationLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			// Check if category already exists in selected folder
			if (allAvailableCategoriesMap[formData.folder1]?.includes(newCategoryName.trim())) {
				setError(`Category "${newCategoryName.trim()}" already exists in this folder.`);
				setCategoryCreationLoading(false);
				return;
			}

			// Get existing categories to check if category already exists in the selected folder
			const { data: existingData, error: existingError } = await supabase
				.from('packages')
				.select('category1')
				.eq('folder1', formData.folder1)
				.eq('category1', newCategoryName.trim())
				.limit(1);

			if (existingError) throw existingError;

			if (existingData && existingData.length > 0) {
				setError(`Category "${newCategoryName.trim()}" already exists in this folder.`);
				setCategoryCreationLoading(false);
				return;
			}

			// Create a placeholder package with this folder and category to establish it in the database
			const { error: insertError } = await supabase
				.from('packages')
				.insert({
					package_name: `__category_placeholder_${Date.now()}`,
					folder1: formData.folder1,
					category1: newCategoryName.trim(),
					description: `This is a placeholder entry to establish the category "${newCategoryName.trim()}" in folder "${formData.folder1}". This entry can be safely deleted once other packages use this category.`
				});

			if (insertError) throw insertError;

			// Update the categories list in the filter store
			const updatedCategories = {
				...allAvailableCategoriesMap,
				[formData.folder1]: [
					...(allAvailableCategoriesMap[formData.folder1] || []),
					newCategoryName.trim()
				].sort()
			};

			// Reset the form
			setNewCategoryName('');
			setIsAddingCategory(false);
			setSuccessMessage(`Category "${newCategoryName.trim()}" has been created successfully in folder "${formData.folder1}".`);

			// Update the store with the new category
			useFilterStore.setState({
				allAvailableCategories: updatedCategories
			});

			// Set the newly created category as the selected category
			setFormData(prev => ({ ...prev, category1: newCategoryName.trim() }));
			setCurrentCategories(updatedCategories[formData.folder1]);

		} catch (err: any) {
			console.error("Error creating category:", err);
			setError(`Failed to create category: ${err.message}`);
		} finally {
			setCategoryCreationLoading(false);
		}
	};


	if (!suggestion) return null;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2, mb: 0 }}>
				<Box component="span" fontWeight="fontWeightMedium">
					Edit Suggestion:
				</Box>
				<Box component="span" fontWeight="fontWeightRegular" sx={{ ml: 0.5 }}>
					{suggestion.package_name}
				</Box>
			</DialogTitle>
			<form onSubmit={handleSubmit}>
				<DialogContent dividers sx={{ p: 3, "&.MuiDialogContent-root": { paddingTop: 2 } }}>
					{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
					{successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
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
								disablePortal // Added this prop
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
												mr: 0.5, // Add some margin between chips
												mb: 0.5, // Add some margin below chips for wrapping
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
				</DialogContent>
				<DialogActions sx={{ p: '16px 24px', borderTop: 1, borderColor: 'divider', mt: 0 }}>
					<Button onClick={onClose} color="inherit" variant="outlined" sx={{ mr: 1 }}>Cancel</Button>
					<Button type="submit" variant="contained" color="primary" disabled={loading || (suggestion?.status !== 'pending' && !isAdmin)}>
						{loading ? <CircularProgress size={24} color="inherit" /> : "Save Changes"}
					</Button>
					{isAdmin && suggestion?.status === 'pending' && ( // Only show if suggestion is still pending
						<Button
							variant="contained"
							color="success"
							onClick={handleSaveAndApprove}
							disabled={loading}
							sx={{ ml: 1 }}
						>
							{loading ? <CircularProgress size={24} color="inherit" /> : "Save & Approve & Add to DB"}
						</Button>
					)}
				</DialogActions>
			</form>
		</Dialog>
	);
};

export default EditSuggestionModal;
