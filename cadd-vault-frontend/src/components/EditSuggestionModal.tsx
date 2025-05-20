// src/components/EditSuggestionModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { PackageSuggestion } from '../types';
import {
	Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
	CircularProgress, Alert, Grid, Autocomplete, Chip, Select, MenuItem, FormControl, InputLabel,
	SelectChangeEvent
	// Box was removed as it's unused
} from '@mui/material';
import { useFilterStore } from '../store/filterStore';

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

	const allAvailableTags = useFilterStore(state => state.allAvailableTags);
	const allAvailableFolders = useFilterStore(state => state.allAvailableFolders);
	const allAvailableCategoriesMap = useFilterStore(state => state.allAvailableCategories);

	const [currentCategories, setCurrentCategories] = useState<string[]>([]);

	useEffect(() => {
		if (suggestion) {
			setFormData({
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
			});
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
	}, [suggestion, isAdmin, open, allAvailableCategoriesMap]);

	useEffect(() => {
		if (formData.folder1 && allAvailableCategoriesMap[formData.folder1]) {
			setCurrentCategories(allAvailableCategoriesMap[formData.folder1]);
		} else {
			setCurrentCategories([]);
		}
		if (formData.folder1 && !allAvailableCategoriesMap[formData.folder1]?.includes(formData.category1 || '')) {
			setFormData(prev => ({ ...prev, category1: '' }));
		}
	}, [formData.folder1, allAvailableCategoriesMap, formData.category1]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setFormData(prev => ({ ...prev, [name as string]: value }));
		if (name === 'folder1') {
			setFormData(prev => ({ ...prev, category1: '' }));
		}
	};

	const handleTagChange = (_event: React.SyntheticEvent, newValue: string[]) => {
		setFormData(prev => ({ ...prev, tags: newValue }));
	};

	const handleSelectChange = (event: SelectChangeEvent<string>, fieldName: 'folder1' | 'category1') => {
		const { value } = event.target;
		setFormData(prev => ({ ...prev, [fieldName]: value }));
		if (fieldName === 'folder1') {
			setFormData(prev => ({ ...prev, category1: '' }));
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

		// Ensure optional fields are undefined if empty, not null, to match PackageSuggestion type
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
			onSaveSuccess();
		} catch (err: any) {
			console.error("Error in handleSubmit:", err);
			setError(err.message || "Failed to update suggestion.");
			setLoading(false);
		}
	};

	if (!suggestion) return null;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle>Edit Suggestion: {suggestion.package_name}</DialogTitle>
			<form onSubmit={handleSubmit}>
				<DialogContent dividers>
					{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
					{successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
					<Grid container spacing={2} sx={{ mt: 0.5 }}>
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
						<Grid item xs={12} sm={6}><TextField label="Publication URL" name="publication_url" type="url" value={formData.publication_url || ''} onChange={handleChange} fullWidth variant="outlined" size="small" /></Grid>
						<Grid item xs={12} sm={6}><TextField label="Webserver URL" name="webserver_url" type="url" value={formData.webserver_url || ''} onChange={handleChange} fullWidth variant="outlined" size="small" /></Grid>
						<Grid item xs={12} sm={6}><TextField label="Repository URL" name="repo_url" type="url" value={formData.repo_url || ''} onChange={handleChange} fullWidth variant="outlined" size="small" /></Grid>
						<Grid item xs={12} sm={6}><TextField label="Other Link URL" name="link_url" type="url" value={formData.link_url || ''} onChange={handleChange} fullWidth variant="outlined" size="small" /></Grid>
						<Grid item xs={12}>
							<Autocomplete
								multiple
								id="tags-edit-suggestion"
								options={allAvailableTags}
								value={formData.tags || []}
								onChange={handleTagChange}
								freeSolo
								renderTags={(value, getTagProps) =>
									value.map((option, index) => {
										const { key, ...otherTagProps } = getTagProps({ index });
										return <Chip key={key} variant="outlined" label={option} {...otherTagProps} size="small" />;
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
								</Select>
							</FormControl>
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
								</Select>
							</FormControl>
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
								disabled={!isAdmin && suggestion?.status !== 'pending'}
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
				<DialogActions sx={{ p: '16px 24px' }}>
					<Button onClick={onClose} color="inherit">Cancel</Button>
					<Button type="submit" variant="contained" color="primary" disabled={loading || (suggestion?.status !== 'pending' && !isAdmin)}>
						{loading ? <CircularProgress size={24} color="inherit" /> : "Save Changes"}
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
};

export default EditSuggestionModal;
