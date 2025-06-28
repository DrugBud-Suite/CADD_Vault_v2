// src/pages/AdminBulkOperationsPage.tsx
import React, { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { Package } from '../types';
import { DataService } from '../services/dataService';
import {
	Container,
	Typography,
	Box,
	Paper,
	TextField,
	Button,
	Alert,
	CircularProgress,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	SelectChangeEvent,
	Chip,
	Autocomplete,
	Divider,
	Grid,
	Tooltip,
	IconButton,
	useTheme,
	Tab,
	Tabs
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
	FolderOutlined,
	CategoryOutlined,
	FileDownload,
	AddCircleOutline,
	FolderSpecialOutlined
} from '@mui/icons-material';
import { useFilterStore } from '../store/filterStore';
import { useShallow } from 'zustand/react/shallow';

// Interface for the bulk operation form
interface BulkOperationForm {
	operation: string;
	filterOptions: {
		folder: string | null;
		category: string | null;
		tags: string[];
	};
	bulkOperations: {  // Change from updateOptions to bulkOperations
		setFolder: string | null;
		setCategory: string | null;
		addTags: string[];
		removeTags: string[];
	};
}

// Interface to track operation results
interface OperationResult {
	status: 'success' | 'error' | 'warning';
	message: string;
	details?: string;
	affectedPackages?: number;
	totalProcessed?: number;
	successCount?: number;
	errorCount?: number;
	errors?: string[];
}

// Interface for the folder/category creation form
interface FolderCategoryForm {
	newFolder: string;
	selectedFolder: string;
	newCategory: string;
}

// Interface for the tag management form
interface TagManagementForm {
	oldTag: string;
	newTag: string;
}

const AdminBulkOperationsPage: React.FC = () => {
	const { currentUser, loading: authLoading, isAdmin } = useAuth();
	const theme = useTheme();

	// Tab state
	const [activeTab, setActiveTab] = useState<number>(0);

	// State for the bulk operation form
	const [form, setForm] = useState<BulkOperationForm>({
		operation: 'update',
		filterOptions: {
			folder: null,
			category: null,
			tags: []
		},
		bulkOperations: {  // Change from updateOptions
			setFolder: null,
			setCategory: null,
			addTags: [],
			removeTags: []
		}
	});

	// State for the folder/category creation form
	const [folderCategoryForm, setFolderCategoryForm] = useState<FolderCategoryForm>({
		newFolder: '',
		selectedFolder: '',
		newCategory: ''
	});

	// State for tag management form
	const [tagManagementForm, setTagManagementForm] = useState<TagManagementForm>({
		oldTag: '',
		newTag: ''
	});

	// States for folder/category creation
	const [isFolderCreating, setIsFolderCreating] = useState<boolean>(false);
	const [isCategoryCreating, setIsCategoryCreating] = useState<boolean>(false);
	const [folderCreationError, setFolderCreationError] = useState<string | null>(null);
	const [folderCreationSuccess, setFolderCreationSuccess] = useState<string | null>(null);
	const [categoryCreationError, setCategoryCreationError] = useState<string | null>(null);
	const [categoryCreationSuccess, setCategoryCreationSuccess] = useState<string | null>(null);

	// States for tag management
	const [isTagUpdating, setIsTagUpdating] = useState<boolean>(false);
	const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);
	const [tagUpdateSuccess, setTagUpdateSuccess] = useState<string | null>(null);
	const [affectedPackagesCount, setAffectedPackagesCount] = useState<number>(0);
	const [tagPreviewPackages, setTagPreviewPackages] = useState<Package[]>([]);
	const [isTagPreviewLoading, setIsTagPreviewLoading] = useState<boolean>(false);
	const [showTagPreview, setShowTagPreview] = useState<boolean>(false);

	// States for UI
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
	const [matchingPackages, setMatchingPackages] = useState<Package[]>([]);
	const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
	const [showPreview, setShowPreview] = useState<boolean>(false);

	// Get filter store data
	const {
		allAvailableTags,
		allAvailableFolders,
		allAvailableCategories,
	} = useFilterStore(useShallow(state => ({
		allAvailableTags: state.allAvailableTags,
		allAvailableFolders: state.allAvailableFolders,
		allAvailableCategories: state.allAvailableCategories
	})));

	// Derived state for available categories based on selected folder
	const availableCategories = form.filterOptions.folder && allAvailableCategories[form.filterOptions.folder]
		? allAvailableCategories[form.filterOptions.folder]
		: [];

	// Fetch packages for preview
	const loadMatchingPackages = useCallback(async () => {
		setIsPreviewLoading(true);
		setShowPreview(true);
		setError(null);

		try {
			// Start with a base query
			let query = supabase.from('packages').select('*');

			// Apply folder filter
			if (form.filterOptions.folder) {
				query = query.eq('folder1', form.filterOptions.folder);
			}

			// Apply category filter (only if folder is selected)
			if (form.filterOptions.folder && form.filterOptions.category) {
				query = query.eq('category1', form.filterOptions.category);
			}

			// Apply tag filters (AND logic for admin operations)
			query = DataService.applyTagFilters(query, form.filterOptions.tags, 'AND');

			// Execute the query
			const { data, error } = await query;

			if (error) {
				throw error;
			}

			setMatchingPackages(data || []);
		} catch (err: any) {
			console.error("Error fetching matching packages:", err);
			setError(`Failed to load matching packages: ${err.message}`);
			setMatchingPackages([]);
		} finally {
			setIsPreviewLoading(false);
		}
	}, [form.filterOptions]);

	// Load packages with a specific tag for preview
	const loadTagPreviewPackages = useCallback(async () => {
		if (!tagManagementForm.oldTag.trim()) {
			setTagUpdateError("Please select a tag to preview affected packages.");
			return;
		}

		setIsTagPreviewLoading(true);
		setShowTagPreview(true);
		setTagUpdateError(null);

		try {
			// Get all packages with the old tag using DataService utility
			const data = await DataService.fetchPackagesWithTag(tagManagementForm.oldTag.trim());

			setTagPreviewPackages(data);
			setAffectedPackagesCount(data.length);

			if (data.length === 0) {
				setTagUpdateError(`No packages found with tag "${tagManagementForm.oldTag.trim()}".`);
			}
		} catch (err: any) {
			console.error("Error fetching packages with tag:", err);
			setTagUpdateError(`Failed to load packages with tag: ${err.message}`);
			setTagPreviewPackages([]);
		} finally {
			setIsTagPreviewLoading(false);
		}
	}, [tagManagementForm.oldTag]);

	// Handle form changes
	const handleOperationChange = (event: SelectChangeEvent) => {
		setForm(prev => ({
			...prev,
			operation: event.target.value
		}));
		setShowPreview(false);
	};

	const handleFilterFolderChange = (event: SelectChangeEvent) => {
		const newFolder = event.target.value === "null" ? null : event.target.value;
		setForm(prev => ({
			...prev,
			filterOptions: {
				...prev.filterOptions,
				folder: newFolder,
				category: null // Reset category when folder changes
			}
		}));
		setShowPreview(false);
	};

	const handleFilterCategoryChange = (event: SelectChangeEvent) => {
		const newCategory = event.target.value === "null" ? null : event.target.value;
		setForm(prev => ({
			...prev,
			filterOptions: {
				...prev.filterOptions,
				category: newCategory
			}
		}));
		setShowPreview(false);
	};

	const handleFilterTagsChange = (_event: React.SyntheticEvent, newValue: string[]) => {
		setForm(prev => ({
			...prev,
			filterOptions: {
				...prev.filterOptions,
				tags: newValue
			}
		}));
		setShowPreview(false);
	};

	const handleUpdateFolderChange = (event: SelectChangeEvent) => {
		const newFolder = event.target.value === "null" ? null : event.target.value;
		setForm(prev => ({
			...prev,
			bulkOperations: {  // Change from updateOptions
				...prev.bulkOperations,
				setFolder: newFolder,
				setCategory: null
			}
		}));
	};

	const handleUpdateCategoryChange = (event: SelectChangeEvent) => {
		const newCategory = event.target.value === "null" ? null : event.target.value;
		setForm(prev => ({
			...prev,
			bulkOperations: {  // Change from updateOptions
				...prev.bulkOperations,
				setCategory: newCategory
			}
		}));
	};

	const handleAddTagsChange = (_event: React.SyntheticEvent, newValue: string[]) => {
		setForm(prev => ({
			...prev,
			bulkOperations: {  // Change from updateOptions
				...prev.bulkOperations,
				addTags: newValue
			}
		}));
	};

	const handleRemoveTagsChange = (_event: React.SyntheticEvent, newValue: string[]) => {
		setForm(prev => ({
			...prev,
			bulkOperations: {  // Change from updateOptions
				...prev.bulkOperations,
				removeTags: newValue
			}
		}));
	};

	// Handle tab change
	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
	};

	// Handle folder/category form changes
	const handleFolderCategoryFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = event.target;
		setFolderCategoryForm(prev => ({
			...prev,
			[name]: value
		}));
	};

	// Handle tag management form changes
	const handleTagManagementFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = event.target;
		setTagManagementForm(prev => ({
			...prev,
			[name]: value
		}));
	};

	// Handle tag selection from autocomplete
	const handleOldTagSelection = (_event: React.SyntheticEvent, value: string | null) => {
		if (value) {
			setTagManagementForm(prev => ({
				...prev,
				oldTag: value
			}));

			// Reset preview when a new tag is selected
			setShowTagPreview(false);
			setTagPreviewPackages([]);
		}
	};

	// Handle updating tags across packages
	const handleUpdateTag = async () => {
		if (!isAdmin) {
			setTagUpdateError("You must be an admin to perform this operation.");
			return;
		}

		if (!tagManagementForm.oldTag.trim()) {
			setTagUpdateError("Please select a tag to replace.");
			return;
		}

		if (!tagManagementForm.newTag.trim()) {
			setTagUpdateError("Please enter a new tag name.");
			return;
		}

		setIsTagUpdating(true);
		setTagUpdateError(null);
		setTagUpdateSuccess(null);
		setAffectedPackagesCount(0);

		try {
			// Use the preview packages if available, otherwise fetch them again
			let packagesWithOldTag: Package[] = [];

			if (showTagPreview && tagPreviewPackages.length > 0) {
				packagesWithOldTag = tagPreviewPackages;
			} else {
				// Get all packages with the old tag using DataService utility
				packagesWithOldTag = await DataService.fetchPackagesWithTag(tagManagementForm.oldTag.trim());
			}

			if (packagesWithOldTag.length === 0) {
				setTagUpdateError(`No packages found with tag "${tagManagementForm.oldTag.trim()}".`);
				setIsTagUpdating(false);
				return;
			}

			let successCount = 0;
			let errorCount = 0;

			// Update each package
			for (const pkg of packagesWithOldTag) {
				try {
					// Get current tags
					const currentTags = pkg.tags || [];

					// Replace old tag with new tag
					const updatedTags = currentTags.map((tag: string) =>
						tag === tagManagementForm.oldTag.trim() ? tagManagementForm.newTag.trim() : tag
					);

					// Update package
					const { error: updateError } = await supabase
						.from('packages')
						.update({ tags: updatedTags })
						.eq('id', pkg.id);

					if (updateError) throw updateError;
					successCount++;
				} catch (err) {
					console.error("Error updating package tags:", err);
					errorCount++;
				}
			}

			// Set the success message
			setAffectedPackagesCount(successCount);
			setTagUpdateSuccess(`Successfully updated tag "${tagManagementForm.oldTag.trim()}" to "${tagManagementForm.newTag.trim()}" in ${successCount} packages.`);

			// If there were errors, also set error message
			if (errorCount > 0) {
				setTagUpdateError(`Failed to update tags in ${errorCount} packages.`);
			}

			// Reset the form
			setTagManagementForm({
				oldTag: '',
				newTag: ''
			});

			// Update the available tags in the store
			// This should fetch fresh tags from the server
			// For now we'll just manually update the store
			const updatedTags = [...allAvailableTags];
			if (!updatedTags.includes(tagManagementForm.newTag.trim())) {
				updatedTags.push(tagManagementForm.newTag.trim());
			}
			// Only remove the old tag if it's not used in any other packages
			if (successCount === packagesWithOldTag.length) {
				const index = updatedTags.indexOf(tagManagementForm.oldTag.trim());
				if (index !== -1) {
					updatedTags.splice(index, 1);
				}
			}

			useFilterStore.setState({
				allAvailableTags: updatedTags.sort()
			});

		} catch (err: any) {
			console.error("Error updating tags:", err);
			setTagUpdateError(`Failed to update tags: ${err.message}`);
		} finally {
			setIsTagUpdating(false);
		}
	};

	const handleFolderSelectChange = (event: SelectChangeEvent) => {
		setFolderCategoryForm(prev => ({
			...prev,
			selectedFolder: event.target.value
		}));
	};

	// Handle creation of new folder
	const handleCreateFolder = async () => {
		if (!isAdmin) {
			setFolderCreationError("You must be an admin to create folders.");
			return;
		}

		if (!folderCategoryForm.newFolder.trim()) {
			setFolderCreationError("Please enter a folder name.");
			return;
		}

		setIsFolderCreating(true);
		setFolderCreationError(null);
		setFolderCreationSuccess(null);

		try {
			// Create new folder in normalized table
			const { error: insertError } = await supabase
				.from('folders')
				.insert({ name: folderCategoryForm.newFolder.trim() })
				.select()
				.single();

			if (insertError) {
				if (insertError.code === '23505') { // Unique constraint violation
				setFolderCreationError(`Folder "${folderCategoryForm.newFolder.trim()}" already exists.`);
				} else {
					throw insertError;
				}
				return;
			}

			setFolderCreationSuccess(`Folder "${folderCategoryForm.newFolder.trim()}" created successfully!`);
			setFolderCategoryForm({ ...folderCategoryForm, newFolder: '' });

			// Refresh metadata
			await DataService.refreshFilterMetadata();

		} catch (error: any) {
			console.error("Error creating folder:", error);
			setFolderCreationError(`Failed to create folder: ${error.message}`);
		} finally {
			setIsFolderCreating(false);
		}
	};

	// Handle creation of new category
	const handleCreateCategory = async () => {
		if (!isAdmin) {
			setCategoryCreationError("You must be an admin to create categories.");
			return;
		}

		if (!folderCategoryForm.selectedFolder) {
			setCategoryCreationError("Please select a folder.");
			return;
		}

		if (!folderCategoryForm.newCategory.trim()) {
			setCategoryCreationError("Please enter a category name.");
			return;
		}

		setIsCategoryCreating(true);
		setCategoryCreationError(null);
		setCategoryCreationSuccess(null);

		try {
			// Use the database function to ensure folder-category relationship
			const { error } = await supabase
				.rpc('ensure_folder_category_exists', {
					folder_name: folderCategoryForm.selectedFolder,
					category_name: folderCategoryForm.newCategory.trim()
				});

			if (error) throw error;

			setCategoryCreationSuccess(`Category "${folderCategoryForm.newCategory.trim()}" created successfully!`);
			setFolderCategoryForm({ ...folderCategoryForm, newCategory: '' });

			// Refresh metadata
			await DataService.refreshFilterMetadata();

		} catch (error: any) {
			console.error("Error creating category:", error);
			setCategoryCreationError(`Failed to create category: ${error.message}`);
		} finally {
			setIsCategoryCreating(false);
		}
	};

	// Execute the bulk operation
	const handleExecuteOperation = async () => {
		if (!isAdmin) {
			setError("You must be an admin to perform this operation.");
			return;
		}

		if (matchingPackages.length === 0) {
			setError("No packages match the current filter criteria.");
			return;
		}

		// Validate that there's at least one update option specified
		const hasUpdateOptions = (
			form.bulkOperations.setFolder !== null ||
			form.bulkOperations.setCategory !== null ||
			form.bulkOperations.addTags.length > 0 ||
			form.bulkOperations.removeTags.length > 0
		);

		if (!hasUpdateOptions) {
			setError("Please specify at least one update option.");
			return;
		}

		setLoading(true);
		setError(null);
		setSuccessMessage(null);
		setOperationResult(null);

		try {
			const packageIds = matchingPackages.map(pkg => pkg.id);
			let successCount = 0;
			let errorCount = 0;

			// Process each package individually to handle tag operations correctly
			for (const packageId of packageIds) {
				try {
					// Get current package data
					const { data: currentPackage, error: fetchError } = await supabase
						.from('packages')
						.select('*')
						.eq('id', packageId)
						.single();

					if (fetchError) throw fetchError;
					if (!currentPackage) continue;

					// Prepare update data
					const updateData: Partial<Package> = {};

					// Update folder
					if (form.bulkOperations.setFolder !== null) {
						updateData.folder1 = form.bulkOperations.setFolder;
					}

					// Update category
					if (form.bulkOperations.setCategory !== null) {
						updateData.category1 = form.bulkOperations.setCategory;
					}

					// Handle tags (add/remove)
					if (form.bulkOperations.addTags.length > 0 || form.bulkOperations.removeTags.length > 0) {
						// Get current tags or initialize empty array
						const currentTags: string[] = currentPackage.tags || [];

						// Add new tags (avoiding duplicates)
						const tagsToAdd = form.bulkOperations.addTags.filter(tag => !currentTags.includes(tag));

						// Remove specified tags
						const tagsAfterRemoval = currentTags.filter(tag => !form.bulkOperations.removeTags.includes(tag));

						// Final tags list
						updateData.tags = [...tagsAfterRemoval, ...tagsToAdd];
					}

					// Only update if there are changes
					if (Object.keys(updateData).length > 0) {
						const { error: updateError } = await supabase
							.from('packages')
							.update(updateData)
							.eq('id', packageId);

						if (updateError) throw updateError;
						successCount++;
					}
				} catch (err) {
					console.error("Error updating package:", err);
					errorCount++;
				}
			}

			// Set operation result
			setOperationResult({
				status: errorCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success',
				message: `Operation completed with ${successCount} packages updated successfully${errorCount > 0 ? ` and ${errorCount} errors` : ''}.`,
				affectedPackages: successCount
			});

			setSuccessMessage(`Successfully updated ${successCount} packages.`);

			// If there were errors, also set error message
			if (errorCount > 0) {
				setError(`Failed to update ${errorCount} packages.`);
			}

			// Refresh the preview
			await loadMatchingPackages();

		} catch (err: any) {
			console.error("Error executing bulk operation:", err);
			setError(`Failed to execute operation: ${err.message}`);
			setOperationResult({
				status: 'error',
				message: `Operation failed: ${err.message}`,
				affectedPackages: 0
			});
		} finally {
			setLoading(false);
		}
	};

	// Download matching packages as JSON for backup
	const handleDownloadPackages = () => {
		if (matchingPackages.length === 0) return;

		const dataStr = JSON.stringify(matchingPackages, null, 2);
		const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

		const exportFileDefaultName = `cadd-vault-packages-${new Date().toISOString()}.json`;

		const linkElement = document.createElement('a');
		linkElement.setAttribute('href', dataUri);
		linkElement.setAttribute('download', exportFileDefaultName);
		linkElement.click();
	};

	// Authentication and admin check
	if (authLoading) {
		return (
			<Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
				<CircularProgress />
			</Container>
		);
	}

	if (!currentUser) {
		return (
			<Container sx={{ py: 4 }}>
				<Alert severity="error">You must be logged in to access this page.</Alert>
			</Container>
		);
	}

	if (!isAdmin) {
		return (
			<Container sx={{ py: 4 }}>
				<Alert severity="error">Access Denied. This page is for administrators only.</Alert>
			</Container>
		);
	}

	return (
		<Container sx={{ py: 4 }}>
			<Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
				Database Administration
			</Typography>
			<Typography variant="subtitle1" color="text.secondary" gutterBottom>
				Manage database entries and structure.
			</Typography>

			<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
				<Tabs value={activeTab} onChange={handleTabChange} aria-label="admin operations tabs">
					<Tab label="Bulk Updates" id="admin-tab-0" aria-controls="admin-tabpanel-0" />
					<Tab label="Folder & Category Management" id="admin-tab-1" aria-controls="admin-tabpanel-1" />
					<Tab label="Tag Management" id="admin-tab-2" aria-controls="admin-tabpanel-2" />
				</Tabs>
			</Box>

			{/* Tab Content */}
			<div
				role="tabpanel"
				hidden={activeTab !== 0}
				id="admin-tabpanel-0"
				aria-labelledby="admin-tab-0"
			>
				{activeTab === 0 && (
					<Grid container spacing={3}>
						<Grid item xs={12}>
							<Paper elevation={3} sx={{ p: 3, mt: 2 }}>
								<Typography variant="h6" gutterBottom>
									Operation Settings
								</Typography>

								<FormControl fullWidth sx={{ mb: 3 }}>
									<InputLabel>Operation Type</InputLabel>
									<Select
										value={form.operation}
										onChange={handleOperationChange}
										label="Operation Type"
									>
										<MenuItem value="update">Update Packages</MenuItem>
									</Select>
								</FormControl>

								<Box sx={{ mb: 4 }}>
									<Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
										<FolderOutlined sx={{ mr: 1 }} />
										Filter Criteria
									</Typography>
									<Alert severity="info" sx={{ mb: 2 }}>
										Define which packages will be affected by this operation.
									</Alert>

									<Grid container spacing={2}>
										<Grid item xs={12} sm={6}>
											<FormControl fullWidth>
												<InputLabel>Folder</InputLabel>
												<Select
													value={form.filterOptions.folder || "null"}
													onChange={handleFilterFolderChange}
													label="Folder"
												>
													<MenuItem value="null">Any Folder</MenuItem>
													{allAvailableFolders.map(folder => (
														<MenuItem key={folder} value={folder}>{folder}</MenuItem>
													))}
												</Select>
											</FormControl>
										</Grid>

										<Grid item xs={12} sm={6}>
											<FormControl fullWidth disabled={!form.filterOptions.folder}>
												<InputLabel>Category</InputLabel>
												<Select
													value={form.filterOptions.category || "null"}
													onChange={handleFilterCategoryChange}
													label="Category"
												>
													<MenuItem value="null">Any Category</MenuItem>
													{availableCategories.map(category => (
														<MenuItem key={category} value={category}>{category}</MenuItem>
													))}
												</Select>
											</FormControl>
										</Grid>

										<Grid item xs={12}>
											<Autocomplete
												multiple
												id="filter-tags"
												options={allAvailableTags}
												value={form.filterOptions.tags}
												onChange={handleFilterTagsChange}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Has Tags"
														placeholder="Select tags to filter by"
														helperText="Only packages having ALL selected tags will be affected"
													/>
												)}
												renderTags={(value, getTagProps) =>
													value.map((option, index) => (
														<Chip
															variant="outlined"
															label={option}
															{...getTagProps({ index })}
															sx={{
																bgcolor: alpha(theme.palette.primary.main, 0.1),
																borderColor: alpha(theme.palette.primary.main, 0.3),
															}}
														/>
													))
												}
											/>
										</Grid>
									</Grid>
								</Box>

								<Button
									variant="outlined"
									color="primary"
									onClick={loadMatchingPackages}
									disabled={isPreviewLoading}
									sx={{ mb: 4 }}
								>
									{isPreviewLoading ? <CircularProgress size={24} /> : 'Preview Matching Packages'}
								</Button>

								<Divider sx={{ mb: 4 }} />

								<Box sx={{ mb: 4 }}>
									<Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
										<CategoryOutlined sx={{ mr: 1 }} />
										Update Options
									</Typography>
									<Alert severity="warning" sx={{ mb: 2 }}>
										Specify the changes to apply to all matching packages.
									</Alert>

									<Grid container spacing={2}>
										<Grid item xs={12} sm={6}>
											<FormControl fullWidth>
												<InputLabel>Change Folder To</InputLabel>
												<Select
													value={form.bulkOperations.setFolder || "null"}
													onChange={handleUpdateFolderChange}
													label="Change Folder To"
												>
													<MenuItem value="null">No Change</MenuItem>
													{allAvailableFolders.map(folder => (
														<MenuItem key={folder} value={folder}>{folder}</MenuItem>
													))}
												</Select>
											</FormControl>
										</Grid>

										<Grid item xs={12} sm={6}>
											<FormControl fullWidth>
												<InputLabel>Change Category To</InputLabel>
												<Select
													value={form.bulkOperations.setCategory || "null"}
													onChange={handleUpdateCategoryChange}
													label="Change Category To"
												>
													<MenuItem value="null">No Change</MenuItem>
													{/* Show all categories from all folders for flexibility */}
													{Object.values(allAvailableCategories).flat().filter(
														// Filter out duplicates
														(c, i, arr) => arr.indexOf(c) === i
													).sort().map(category => (
														<MenuItem key={category} value={category}>{category}</MenuItem>
													))}
												</Select>
											</FormControl>
										</Grid>

										<Grid item xs={12} sm={6}>
											<Autocomplete
												multiple
												id="add-tags"
												options={allAvailableTags.filter(tag => !form.bulkOperations.addTags.includes(tag))}
												value={form.bulkOperations.addTags}
												onChange={handleAddTagsChange}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Add Tags"
														placeholder="Select tags to add"
														helperText="These tags will be added to all matching packages"
													/>
												)}
												renderTags={(value, getTagProps) =>
													value.map((option, index) => (
														<Chip
															variant="outlined"
															label={option}
															{...getTagProps({ index })}
															sx={{
																bgcolor: alpha(theme.palette.success.main, 0.1),
																borderColor: alpha(theme.palette.success.main, 0.3),
															}}
														/>
													))
												}
											/>
										</Grid>

										<Grid item xs={12} sm={6}>
											<Autocomplete
												multiple
												id="remove-tags"
												options={allAvailableTags.filter(tag => !form.bulkOperations.removeTags.includes(tag))}
												value={form.bulkOperations.removeTags}
												onChange={handleRemoveTagsChange}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Remove Tags"
														placeholder="Select tags to remove"
														helperText="These tags will be removed from all matching packages"
													/>
												)}
												renderTags={(value, getTagProps) =>
													value.map((option, index) => (
														<Chip
															variant="outlined"
															label={option}
															{...getTagProps({ index })}
															sx={{
																bgcolor: alpha(theme.palette.error.main, 0.1),
																borderColor: alpha(theme.palette.error.main, 0.3),
															}}
														/>
													))
												}
											/>
										</Grid>
									</Grid>
								</Box>

								{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
								{successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

								{operationResult && (
									<Alert
										severity={operationResult.status}
										sx={{ mb: 2 }}
									>
										{operationResult.message}
										{operationResult.details && (
											<Typography variant="body2" mt={1}>
												{operationResult.details}
											</Typography>
										)}
									</Alert>
								)}

								<Button
									variant="contained"
									color="primary"
									disabled={loading || matchingPackages.length === 0}
									onClick={handleExecuteOperation}
									sx={{ mr: 2 }}
								>
									{loading ? <CircularProgress size={24} /> : 'Execute Operation'}
								</Button>

								<Button
									variant="outlined"
									color="secondary"
									onClick={() => setForm({
										operation: 'update',
										filterOptions: {
											folder: null,
											category: null,
											tags: []
										},
										bulkOperations: {
											setFolder: null,
											setCategory: null,
											addTags: [],
											removeTags: []
										}
									})}
									disabled={loading}
								>
									Reset Form
								</Button>
							</Paper>
						</Grid>

						{showPreview && (
							<Grid item xs={12}>
								<Paper elevation={3} sx={{ p: 3, mt: 2 }}>
									<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
										<Typography variant="h6">
											{isPreviewLoading
												? 'Loading Matching Packages...'
												: `Matching Packages (${matchingPackages.length})`}
										</Typography>

										{matchingPackages.length > 0 && (
											<Tooltip title="Download as JSON">
												<IconButton onClick={handleDownloadPackages} color="primary">
													<FileDownload />
												</IconButton>
											</Tooltip>
										)}
									</Box>

									{isPreviewLoading ? (
										<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
											<CircularProgress />
										</Box>
									) : matchingPackages.length === 0 ? (
										<Alert severity="info">
											No packages match the selected filter criteria.
										</Alert>
									) : (
										<TableContainer sx={{ maxHeight: 400 }}>
											<Table stickyHeader>
												<TableHead>
													<TableRow>
														<TableCell sx={{ fontWeight: 'bold' }}>Package Name</TableCell>
														<TableCell sx={{ fontWeight: 'bold' }}>Folder</TableCell>
														<TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
														<TableCell sx={{ fontWeight: 'bold' }}>Tags</TableCell>
													</TableRow>
												</TableHead>
												<TableBody>
													{matchingPackages.map((pkg) => (
														<TableRow key={pkg.id} hover>
															<TableCell>{pkg.package_name}</TableCell>
															<TableCell>{pkg.folder1 || '—'}</TableCell>
															<TableCell>{pkg.category1 || '—'}</TableCell>
															<TableCell>
																<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
																	{pkg.tags?.slice(0, 5).map((tag) => (
																		<Chip
																			key={tag}
																			label={tag}
																			size="small"
																			sx={{
																				fontSize: '0.75rem',
																				height: 22
																			}}
																		/>
																	))}
																	{(pkg.tags?.length || 0) > 5 && (
																		<Chip
																			label={`+${(pkg.tags?.length || 0) - 5} more`}
																			size="small"
																			variant="outlined"
																			sx={{
																				fontSize: '0.75rem',
																				height: 22
																			}}
																		/>
																	)}
																	{(!pkg.tags || pkg.tags.length === 0) && (
																		<Typography variant="body2" color="text.secondary">
																			No tags
																		</Typography>
																	)}
																</Box>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</TableContainer>
									)}
								</Paper>
							</Grid>
						)}
					</Grid>
				)}
			</div>

			{/* Tag Management Tab */}
			<div
				role="tabpanel"
				hidden={activeTab !== 2}
				id="admin-tabpanel-2"
				aria-labelledby="admin-tab-2"
			>
				{activeTab === 2 && (
					<Grid container spacing={3}>
						<Grid item xs={12}>
							<Paper elevation={3} sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
									<FolderSpecialOutlined sx={{ mr: 1 }} />
									Tag Management
								</Typography>

								<Alert severity="info" sx={{ mb: 3 }}>
									Find and correct tags with typos. Changes will be applied to all packages that have the selected tag.
								</Alert>

								{tagUpdateError && (
									<Alert severity="error" sx={{ mb: 2 }}>
										{tagUpdateError}
									</Alert>
								)}

								{tagUpdateSuccess && (
									<Alert severity="success" sx={{ mb: 2 }}>
										{tagUpdateSuccess}
									</Alert>
								)}

								<Grid container spacing={2} sx={{ mb: 3 }}>
									<Grid item xs={12} sm={6}>
										<Autocomplete
											options={allAvailableTags}
											value={tagManagementForm.oldTag}
											onChange={(event, value) => handleOldTagSelection(event, value)}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Tag to Replace"
													name="oldTag"
													fullWidth
													helperText="Select the tag that has a typo or needs to be renamed"
												/>
											)}
										/>
									</Grid>

									<Grid item xs={12} sm={6}>
										<TextField
											label="New Tag Name"
											name="newTag"
											value={tagManagementForm.newTag}
											onChange={handleTagManagementFormChange}
											fullWidth
											helperText="Enter the corrected tag name"
										/>
									</Grid>
								</Grid>

								<Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
									<Button
										variant="outlined"
										color="primary"
										onClick={loadTagPreviewPackages}
										disabled={isTagPreviewLoading || !tagManagementForm.oldTag}
									>
										{isTagPreviewLoading ? <CircularProgress size={24} /> : 'Preview Affected Packages'}
									</Button>

									{!showTagPreview && tagManagementForm.oldTag && (
										<Typography variant="body2" sx={{ alignSelf: 'center', fontStyle: 'italic' }}>
											Click to see which packages will be affected
										</Typography>
									)}
								</Box>

								<Box sx={{ display: 'flex', gap: 2 }}>
									<Button
										variant="contained"
										color="primary"
										onClick={handleUpdateTag}
										disabled={isTagUpdating || !tagManagementForm.oldTag || !tagManagementForm.newTag || affectedPackagesCount === 0}
										sx={{ mr: 2 }}
									>
										{isTagUpdating ? <CircularProgress size={24} /> : 'Update Tag'}
									</Button>

									<Button
										variant="outlined"
										color="secondary"
										onClick={() => {
											setTagManagementForm({
												oldTag: '',
												newTag: ''
											});
											setTagUpdateError(null);
											setTagUpdateSuccess(null);
											setShowTagPreview(false);
											setTagPreviewPackages([]);
											setAffectedPackagesCount(0);
										}}
										disabled={isTagUpdating}
									>
										Reset Form
									</Button>
								</Box>

								{affectedPackagesCount > 0 && !showTagPreview && (
									<Box sx={{ mt: 3 }}>
										<Typography variant="subtitle2">
											Tags updated in {affectedPackagesCount} packages
										</Typography>
									</Box>
								)}

								<Divider sx={{ my: 3 }} />

								<Typography variant="subtitle1" sx={{ mb: 2 }}>
									Available Tags ({allAvailableTags.length})
								</Typography>
								<Box sx={{
									maxHeight: 200,
									overflowY: 'auto',
									border: 1,
									borderColor: 'divider',
									borderRadius: 1,
									p: 1
								}}>
									{allAvailableTags.length > 0 ? (
										<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
											{allAvailableTags.map(tag => (
												<Chip
													key={tag}
													label={tag}
													size="small"
													sx={{
														bgcolor: alpha(theme.palette.primary.main, 0.1),
													}}
												/>
											))}
										</Box>
									) : (
										<Typography variant="body2" color="text.secondary">
											No tags available
										</Typography>
									)}
								</Box>

								{showTagPreview && (
									<Box sx={{ mt: 3 }}>
										<Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
											<span>Packages With Tag "{tagManagementForm.oldTag}" ({tagPreviewPackages.length})</span>
											{tagPreviewPackages.length > 0 && (
												<Tooltip title="Download as JSON">
													<IconButton
														size="small"
														onClick={() => {
															const dataStr = JSON.stringify(tagPreviewPackages, null, 2);
															const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
															const exportFileDefaultName = `packages-with-tag-${tagManagementForm.oldTag}-${new Date().toISOString()}.json`;
															const linkElement = document.createElement('a');
															linkElement.setAttribute('href', dataUri);
															linkElement.setAttribute('download', exportFileDefaultName);
															linkElement.click();
														}}
													>
														<FileDownload />
													</IconButton>
												</Tooltip>
											)}
										</Typography>

										{isTagPreviewLoading ? (
											<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
												<CircularProgress />
											</Box>
										) : tagPreviewPackages.length === 0 ? (
											<Alert severity="info">No packages found with this tag.</Alert>
										) : (
											<TableContainer sx={{ maxHeight: 400 }}>
												<Table stickyHeader size="small">
													<TableHead>
														<TableRow>
															<TableCell>Package Name</TableCell>
															<TableCell>Folder</TableCell>
															<TableCell>Category</TableCell>
															<TableCell>Tags</TableCell>
														</TableRow>
													</TableHead>
													<TableBody>
														{tagPreviewPackages.map(pkg => (
															<TableRow key={pkg.id} hover>
																<TableCell>{pkg.package_name}</TableCell>
																<TableCell>{pkg.folder1 || 'None'}</TableCell>
																<TableCell>{pkg.category1 || 'None'}</TableCell>
																<TableCell>
																	<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
																		{pkg.tags && pkg.tags.map(tag => (
																			<Chip
																				key={`${pkg.id}-${tag}`}
																				label={tag}
																				size="small"
																				sx={{
																					bgcolor: tag === tagManagementForm.oldTag
																						? alpha(theme.palette.warning.main, 0.2)
																						: alpha(theme.palette.primary.main, 0.1),
																					fontWeight: tag === tagManagementForm.oldTag ? 'bold' : 'normal',
																					height: 22
																				}}
																			/>
																		))}
																		{(!pkg.tags || pkg.tags.length === 0) && (
																			<Typography variant="body2" color="text.secondary">
																				No tags
																			</Typography>
																		)}
																	</Box>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</TableContainer>
										)}
									</Box>
								)}
							</Paper>
						</Grid>
					</Grid>
				)}
			</div>

			{/* Folder & Category Management Tab */}
			<div
				role="tabpanel"
				hidden={activeTab !== 1}
				id="admin-tabpanel-1"
				aria-labelledby="admin-tab-1"
			>
				{activeTab === 1 && (
					<Grid container spacing={3}>
						{/* Create New Folder Section */}
						<Grid item xs={12} md={6}>
							<Paper elevation={3} sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
									<FolderSpecialOutlined sx={{ mr: 1 }} />
									Create New Folder
								</Typography>

								<Alert severity="info" sx={{ mb: 3 }}>
									Add a new top-level folder to organize packages. Folders are the main classification groups.
								</Alert>

								{folderCreationError && (
									<Alert severity="error" sx={{ mb: 2 }}>
										{folderCreationError}
									</Alert>
								)}

								{folderCreationSuccess && (
									<Alert severity="success" sx={{ mb: 2 }}>
										{folderCreationSuccess}
									</Alert>
								)}

								<Grid container spacing={2}>
									<Grid item xs={12}>
										<TextField
											fullWidth
											label="New Folder Name"
											name="newFolder"
											value={folderCategoryForm.newFolder}
											onChange={handleFolderCategoryFormChange}
											placeholder="Enter folder name"
											helperText="This will create a new folder in the database"
										/>
									</Grid>
									<Grid item xs={12}>
										<Button
											variant="contained"
											color="primary"
											onClick={handleCreateFolder}
											disabled={isFolderCreating || !folderCategoryForm.newFolder.trim()}
											startIcon={isFolderCreating ? <CircularProgress size={20} /> : <AddCircleOutline />}
											fullWidth
										>
											{isFolderCreating ? 'Creating...' : 'Create Folder'}
										</Button>
									</Grid>
								</Grid>

								<Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
									Existing Folders ({allAvailableFolders.length})
								</Typography>
								<Box sx={{
									maxHeight: 200,
									overflowY: 'auto',
									border: 1,
									borderColor: 'divider',
									borderRadius: 1,
									p: 1
								}}>
									{allAvailableFolders.length > 0 ? (
										<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
											{allAvailableFolders.map(folder => (
												<Chip
													key={folder}
													label={folder}
													variant="outlined"
													size="small"
													sx={{
														bgcolor: alpha(theme.palette.primary.main, 0.05),
													}}
												/>
											))}
										</Box>
									) : (
										<Typography variant="body2" color="text.secondary">
											No folders defined yet.
										</Typography>
									)}
								</Box>
							</Paper>
						</Grid>

						{/* Create New Category Section */}
						<Grid item xs={12} md={6}>
							<Paper elevation={3} sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
									<CategoryOutlined sx={{ mr: 1 }} />
									Create New Category
								</Typography>

								<Alert severity="info" sx={{ mb: 3 }}>
									Add a new category within an existing folder. Categories are subgroups of folders.
								</Alert>

								{categoryCreationError && (
									<Alert severity="error" sx={{ mb: 2 }}>
										{categoryCreationError}
									</Alert>
								)}

								{categoryCreationSuccess && (
									<Alert severity="success" sx={{ mb: 2 }}>
										{categoryCreationSuccess}
									</Alert>
								)}

								<Grid container spacing={2}>
									<Grid item xs={12}>
										<FormControl fullWidth>
											<InputLabel>Select Folder</InputLabel>
											<Select
												value={folderCategoryForm.selectedFolder}
												onChange={handleFolderSelectChange}
												label="Select Folder"
												disabled={isCategoryCreating || allAvailableFolders.length === 0}
											>
												{allAvailableFolders.map(folder => (
													<MenuItem key={folder} value={folder}>{folder}</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>
									<Grid item xs={12}>
										<TextField
											fullWidth
											label="New Category Name"
											name="newCategory"
											value={folderCategoryForm.newCategory}
											onChange={handleFolderCategoryFormChange}
											placeholder="Enter category name"
											helperText="This will create a new category within the selected folder"
											disabled={!folderCategoryForm.selectedFolder || isCategoryCreating}
										/>
									</Grid>
									<Grid item xs={12}>
										<Button
											variant="contained"
											color="primary"
											onClick={handleCreateCategory}
											disabled={
												isCategoryCreating ||
												!folderCategoryForm.selectedFolder ||
												!folderCategoryForm.newCategory.trim()
											}
											startIcon={isCategoryCreating ? <CircularProgress size={20} /> : <AddCircleOutline />}
											fullWidth
										>
											{isCategoryCreating ? 'Creating...' : 'Create Category'}
										</Button>
									</Grid>
								</Grid>

								{folderCategoryForm.selectedFolder && (
									<>
										<Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
											Existing Categories in "{folderCategoryForm.selectedFolder}" ({(allAvailableCategories[folderCategoryForm.selectedFolder] || []).length})
										</Typography>
										<Box sx={{
											maxHeight: 200,
											overflowY: 'auto',
											border: 1,
											borderColor: 'divider',
											borderRadius: 1,
											p: 1
										}}>
											{allAvailableCategories[folderCategoryForm.selectedFolder]?.length > 0 ? (
												<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
													{allAvailableCategories[folderCategoryForm.selectedFolder].map(category => (
														<Chip
															key={category}
															label={category}
															variant="outlined"
															size="small"
															sx={{
																bgcolor: alpha(theme.palette.secondary.main, 0.05),
															}}
														/>
													))}
												</Box>
											) : (
												<Typography variant="body2" color="text.secondary">
													No categories defined in this folder yet.
												</Typography>
											)}
										</Box>
									</>
								)}
							</Paper>
						</Grid>
					</Grid>
				)}
			</div>
		</Container>
	);
};

export default AdminBulkOperationsPage;
