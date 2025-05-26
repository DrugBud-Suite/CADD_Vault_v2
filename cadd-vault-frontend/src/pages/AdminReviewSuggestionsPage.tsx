// src/pages/AdminReviewSuggestionsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { PackageSuggestion, Package as PackageType } from '../types'; // PackageType for adding to packages table
import {
	Box, Typography, CircularProgress, Paper, Alert, Container,
	Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
	Button, IconButton, Tooltip, Dialog, DialogActions, DialogContent,
	DialogContentText, DialogTitle, TextField, Tabs, Tab, Snackbar,
	Checkbox, FormControlLabel, ButtonGroup
	// Grid and MuiLink removed as they were unused
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'; // For permanent delete
import AddToQueueIcon from '@mui/icons-material/AddToQueue'; // For "Add to Database"
import CodeIcon from '@mui/icons-material/Code'; // For repository
import ArticleIcon from '@mui/icons-material/Article'; // For publication
import WebIcon from '@mui/icons-material/Web'; // For webserver
import LinkIcon from '@mui/icons-material/Link'; // For other links
import EditSuggestionModal from '../components/EditSuggestionModal';

const isValidUrl = (urlString: string | undefined | null): boolean => {
	if (!urlString) return false;
	try {
		const url = new URL(urlString);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (e) {
		return false;
	}
};

const URLIcon: React.FC<{
	url: string | undefined | null,
	type: 'repo' | 'publication' | 'webserver' | 'link',
	isRequired?: boolean
}> = ({ url, type, isRequired = false }) => {
	const getIcon = () => {
		switch (type) {
			case 'repo': return <CodeIcon fontSize="small" />;
			case 'publication': return <ArticleIcon fontSize="small" />;
			case 'webserver': return <WebIcon fontSize="small" />;
			case 'link': return <LinkIcon fontSize="small" />;
		}
	};

	const getTooltipTitle = () => {
		if (!url && !isRequired) return `No ${type} URL provided`;
		if (!url && isRequired) return `${type} URL required but missing`;
		if (!isValidUrl(url)) return `Invalid ${type} URL: ${url}`;
		return `${type} URL: ${url}`;
	};

	const getColor = () => {
		if (!url && !isRequired) return 'disabled';
		if (!url && isRequired) return 'error';
		if (isValidUrl(url)) return 'success';
		return 'error';
	};

	return (
		<Tooltip title={getTooltipTitle()}>
			<Box component="span" sx={{ color: getColor() === 'success' ? 'success.main' : getColor() === 'error' ? 'error.main' : 'text.disabled' }}>
				{getIcon()}
			</Box>
		</Tooltip>
	);
};

const PackageTooltipContent: React.FC<{ suggestion: PackageSuggestion }> = ({ suggestion }) => {
	return (
		<Box sx={{ maxWidth: 500 }}>
			<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
				{suggestion.package_name}
			</Typography>

			{suggestion.description && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					<strong>Description:</strong> {suggestion.description}
				</Typography>
			)}

			{suggestion.suggestion_reason && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					<strong>Suggestion Reason:</strong> {suggestion.suggestion_reason}
				</Typography>
			)}

			{suggestion.tags && suggestion.tags.length > 0 && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					<strong>Tags:</strong> {suggestion.tags.join(', ')}
				</Typography>
			)}

			{suggestion.license && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					<strong>License:</strong> {suggestion.license}
				</Typography>
			)}

			{suggestion.folder1 && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					<strong>Folder:</strong> {suggestion.folder1}
				</Typography>
			)}

			{suggestion.category1 && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					<strong>Category:</strong> {suggestion.category1}
				</Typography>
			)}

			<Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
				URLs:
			</Typography>
			<Box sx={{ pl: 1, mb: 1 }}>
				{suggestion.repo_url ? (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
						<CodeIcon fontSize="small" color="success" />
						Repository:
						<Box component="a" href={suggestion.repo_url} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
							URL
						</Box>
					</Typography>
				) : (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
						<CodeIcon fontSize="small" sx={{ mr: 0.5 }} />
						Repository: Not provided
					</Typography>
				)}

				{suggestion.publication_url ? (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
						<ArticleIcon fontSize="small" color="success" />
						Publication:
						<Box component="a" href={suggestion.publication_url} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
							URL
						</Box>
					</Typography>
				) : (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
						<ArticleIcon fontSize="small" sx={{ mr: 0.5 }} />
						Publication: Not provided
					</Typography>
				)}

				{suggestion.webserver_url ? (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
						<WebIcon fontSize="small" color="success" />
						Webserver:
						<Box component="a" href={suggestion.webserver_url} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
							URL
						</Box>
					</Typography>
				) : (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
						<WebIcon fontSize="small" sx={{ mr: 0.5 }} />
						Webserver: Not provided
					</Typography>
				)}

				{suggestion.link_url ? (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
						<LinkIcon fontSize="small" color="success" />
						Other Link:
						<Box component="a" href={suggestion.link_url} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
							URL
						</Box>
					</Typography>
				) : (
					<Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
						<LinkIcon fontSize="small" sx={{ mr: 0.5 }} />
						Other Link: Not provided
					</Typography>
				)}
			</Box>

			<Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
				Submission Details:
			</Typography>
			<Box sx={{ pl: 1, mb: 1 }}>
				<Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
					<strong>Submitted by:</strong> {suggestion.suggester_email || 'Anonymous'}
				</Typography>
				<Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
					<strong>Date:</strong> {new Date(suggestion.created_at).toLocaleDateString()} at {new Date(suggestion.created_at).toLocaleTimeString()}
				</Typography>
				<Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
					<strong>Status:</strong> {suggestion.status}
				</Typography>
				{suggestion.reviewed_at && (
					<Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
						<strong>Reviewed:</strong> {new Date(suggestion.reviewed_at).toLocaleDateString()} at {new Date(suggestion.reviewed_at).toLocaleTimeString()}
					</Typography>
				)}
			</Box>

			{suggestion.admin_notes && (
				<Box sx={{ mt: 1, p: 1, backgroundColor: 'action.hover', borderRadius: 1 }}>
					<Typography variant="body2" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
						<strong>Admin Notes:</strong> {suggestion.admin_notes}
					</Typography>
				</Box>
			)}
		</Box>
	);
};


const AdminReviewSuggestionsPage: React.FC = () => {
	const navigate = useNavigate();
	const { isAdmin, loading: authLoading, currentUser } = useAuth();
	const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [actionLoading, setActionLoading] = useState<string | null>(null); // For specific row actions
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);


	const [selectedSuggestionForReject, setSelectedSuggestionForReject] = useState<PackageSuggestion | null>(null);
	const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
	const [adminNotesForReject, setAdminNotesForReject] = useState('');

	const [editingSuggestion, setEditingSuggestion] = useState<PackageSuggestion | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'added'>('pending');

	// Batch operations state
	const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
	const [isSelectAll, setIsSelectAll] = useState(false);
	const [batchActionLoading, setBatchActionLoading] = useState(false);

	const fetchSuggestions = useCallback(async (status: typeof filterStatus) => {
		setLoading(true);
		setError(null);
		try {
			const { data, error: rpcError } = await supabase
				.rpc('get_suggestions_with_user_email', { filter_status: status });

			if (rpcError) {
				console.error("Supabase RPC fetch error:", rpcError);
				if (rpcError.code === '42804' && rpcError.details?.includes('character varying(255)')) {
					setError(`Database function error: Email column type mismatch. Ensure 'u.email::text' is used. Original: ${rpcError.message}`);
				} else {
					setError(`Failed to load suggestions: ${rpcError.message}`);
				}
				setSuggestions([]);
				return;
			}
			setSuggestions(data as PackageSuggestion[] || []);
		} catch (err: any) {
			console.error("Error fetching suggestions:", err.message);
			setError(`Failed to load suggestions: ${err.message}`);
			setSuggestions([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!authLoading && !isAdmin) {
			navigate('/');
		} else if (isAdmin) {
			fetchSuggestions(filterStatus);
		}
	}, [isAdmin, authLoading, navigate, fetchSuggestions, filterStatus]);

	const handleApproveSuggestion = async (suggestionId: string) => {
		if (!currentUser) return;
		setActionLoading(suggestionId);
		try {
			const { error: updateError } = await supabase
				.from('package_suggestions')
				.update({
					status: 'approved',
					reviewed_at: new Date().toISOString(),
					reviewed_by_admin_id: currentUser.id
				})
				.eq('id', suggestionId);
			if (updateError) throw updateError;
			setSuccessMessage("Suggestion approved!");
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			setError(`Failed to approve suggestion: ${err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleUpdateSuggestionStatus = async (suggestionId: string, newStatus: 'rejected' | 'added', notes?: string) => {
		if (!currentUser) return;
		setActionLoading(suggestionId);
		try {
			const { error: updateError } = await supabase
				.from('package_suggestions')
				.update({
					status: newStatus,
					admin_notes: notes,
					reviewed_at: new Date().toISOString(),
					reviewed_by_admin_id: currentUser.id
				})
				.eq('id', suggestionId);

			if (updateError) throw updateError;
			setSuccessMessage(`Suggestion status updated to ${newStatus}.`);
			fetchSuggestions(filterStatus);
			setIsRejectModalOpen(false);
			setSelectedSuggestionForReject(null);
			setAdminNotesForReject('');
		} catch (err: any) {
			setError(`Failed to update suggestion status: ${err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleAddPackageDirectly = async (suggestion: PackageSuggestion) => {
		if (!currentUser) return;
		setActionLoading(suggestion.id);
		setError(null);
		setSuccessMessage(null);

		const newPackageId = crypto.randomUUID(); // Generate a new UUID for the package

		const packageToInsert: Omit<PackageType, 'average_rating' | 'ratings_count' | 'ratings_sum' | 'github_stars' | 'last_commit' | 'last_commit_ago' | 'citations' | 'journal' | 'jif' | 'primary_language' | 'github_owner' | 'github_repo' | 'page_icon'> & { id: string } = {
			id: newPackageId, // Assign the generated UUID
			package_name: suggestion.package_name,
			description: suggestion.description || undefined,
			publication: suggestion.publication_url || undefined,
			webserver: suggestion.webserver_url || undefined,
			repo_link: suggestion.repo_url || undefined,
			link: suggestion.link_url || undefined,
			license: suggestion.license || undefined,
			tags: suggestion.tags || undefined,
			folder1: suggestion.folder1 || undefined,
			category1: suggestion.category1 || undefined,
			// These fields will be populated by backend scripts or have defaults in DB
		};

		try {
			const { data: insertedPackage, error: insertError } = await supabase
				.from('packages')
				.insert(packageToInsert)
				.select()
				.single();

			if (insertError) {
				console.error("Error inserting into packages table:", insertError);
				throw insertError;
			}

			if (insertedPackage) {
				const { error: updateSuggestionError } = await supabase
					.from('package_suggestions')
					.update({
						status: 'added',
						reviewed_at: new Date().toISOString(),
						reviewed_by_admin_id: currentUser.id,
						admin_notes: suggestion.admin_notes ? `${suggestion.admin_notes}; Added to DB.` : 'Added to DB.'
					})
					.eq('id', suggestion.id);

				if (updateSuggestionError) {
					console.error("Error updating suggestion status to 'added':", updateSuggestionError);
					setError(`Package added, but failed to update suggestion status: ${updateSuggestionError.message}`);
				} else {
					setSuccessMessage(`Package "${suggestion.package_name}" added to database and suggestion marked as 'Added'.`);
				}
			}
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			setError(`Failed to add package directly: ${err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleDeleteSuggestion = async (suggestionId: string, packageName: string) => {
		if (!window.confirm(`Are you sure you want to permanently delete the suggestion for "${packageName}"? This action cannot be undone.`)) return;
		setActionLoading(suggestionId);
		setError(null);
		setSuccessMessage(null);
		try {
			const { error: deleteError } = await supabase
				.from('package_suggestions')
				.delete()
				.eq('id', suggestionId);

			if (deleteError) throw deleteError;
			setSuccessMessage(`Suggestion "${packageName}" deleted successfully.`);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			setError(`Failed to delete suggestion: ${err.message}`);
		} finally {
			setActionLoading(null);
		}
	};


	const handleOpenEditModal = (suggestion: PackageSuggestion) => {
		setEditingSuggestion(suggestion);
		setIsEditModalOpen(true);
	};
	const handleCloseEditModal = () => {
		setEditingSuggestion(null);
		setIsEditModalOpen(false);
	};
	const handleEditSaveSuccess = () => {
		fetchSuggestions(filterStatus);
		setIsEditModalOpen(false);
		setEditingSuggestion(null);
		setSuccessMessage("Suggestion updated successfully.");
	};

	const openRejectModal = (suggestion: PackageSuggestion) => {
		setSelectedSuggestionForReject(suggestion);
		setAdminNotesForReject(suggestion.admin_notes || '');
		setIsRejectModalOpen(true);
	};
	const handleCloseRejectModal = () => {
		setSelectedSuggestionForReject(null);
		setIsRejectModalOpen(false);
		setAdminNotesForReject('');
	};

	const handleTabChange = (_event: React.SyntheticEvent, newValue: 'pending' | 'approved' | 'rejected' | 'added') => {
		setFilterStatus(newValue);
		// Clear selections when changing tabs
		setSelectedSuggestions(new Set());
		setIsSelectAll(false);
	};

	// Batch operations handlers
	const handleSelectAll = () => {
		if (isSelectAll) {
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
		} else {
			const allIds = new Set(suggestions.map(s => s.id));
			setSelectedSuggestions(allIds);
			setIsSelectAll(true);
		}
	};

	const handleSelectSuggestion = (suggestionId: string) => {
		const newSelected = new Set(selectedSuggestions);
		if (newSelected.has(suggestionId)) {
			newSelected.delete(suggestionId);
		} else {
			newSelected.add(suggestionId);
		}
		setSelectedSuggestions(newSelected);
		setIsSelectAll(newSelected.size === suggestions.length);
	};

	const handleBatchApprove = async () => {
		if (selectedSuggestions.size === 0) return;
		if (!window.confirm(`Are you sure you want to approve ${selectedSuggestions.size} selected suggestion(s)?`)) return;

		setBatchActionLoading(true);
		setError(null);

		try {
			const { error: updateError } = await supabase
				.from('package_suggestions')
				.update({
					status: 'approved',
					reviewed_at: new Date().toISOString(),
					reviewed_by_admin_id: currentUser?.id
				})
				.in('id', Array.from(selectedSuggestions));

			if (updateError) throw updateError;

			setSuccessMessage(`${selectedSuggestions.size} suggestion(s) approved successfully!`);
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			setError(`Failed to approve suggestions: ${err.message}`);
		} finally {
			setBatchActionLoading(false);
		}
	};

	const handleBatchReject = async () => {
		if (selectedSuggestions.size === 0) return;
		const adminNotes = window.prompt(`Please provide a reason for rejecting ${selectedSuggestions.size} selected suggestion(s):`);
		if (!adminNotes) return;

		setBatchActionLoading(true);
		setError(null);

		try {
			const { error: updateError } = await supabase
				.from('package_suggestions')
				.update({
					status: 'rejected',
					admin_notes: adminNotes,
					reviewed_at: new Date().toISOString(),
					reviewed_by_admin_id: currentUser?.id
				})
				.in('id', Array.from(selectedSuggestions));

			if (updateError) throw updateError;

			setSuccessMessage(`${selectedSuggestions.size} suggestion(s) rejected successfully!`);
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			setError(`Failed to reject suggestions: ${err.message}`);
		} finally {
			setBatchActionLoading(false);
		}
	};

	const handleBatchDelete = async () => {
		if (selectedSuggestions.size === 0) return;
		if (!window.confirm(`Are you sure you want to permanently delete ${selectedSuggestions.size} selected suggestion(s)? This action cannot be undone.`)) return;

		setBatchActionLoading(true);
		setError(null);

		try {
			const { error: deleteError } = await supabase
				.from('package_suggestions')
				.delete()
				.in('id', Array.from(selectedSuggestions));

			if (deleteError) throw deleteError;

			setSuccessMessage(`${selectedSuggestions.size} suggestion(s) deleted successfully!`);
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			setError(`Failed to delete suggestions: ${err.message}`);
		} finally {
			setBatchActionLoading(false);
		}
	};

	const getStatusChipColor = (status: PackageSuggestion['status']) => {
		switch (status) {
			case 'pending': return 'warning';
			case 'approved': return 'success';
			case 'rejected': return 'error';
			case 'added': return 'info';
			default: return 'default';
		}
	};

	if (authLoading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}
	if (!isAdmin) {
		return <Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="error">Access Denied. Admins only.</Alert></Container>;
	}

	return (
		<Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
			<Typography variant="h4" gutterBottom component="h1" sx={{
				mb: 2,
				color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary
			}}>
				Review Package Suggestions
			</Typography>

			<Snackbar
				open={!!successMessage}
				autoHideDuration={6000}
				onClose={() => setSuccessMessage(null)}
				message={successMessage}
			/>

			<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
				<Tabs value={filterStatus} onChange={handleTabChange} aria-label="suggestion status filter">
					<Tab label="Pending" value="pending" />
					<Tab label="Approved" value="approved" />
					<Tab label="Rejected" value="rejected" />
					<Tab label="Added to DB" value="added" />
				</Tabs>
			</Box>

			{loading && <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>}
			{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

			{!loading && !error && suggestions.length === 0 && (
				<Typography sx={{ mt: 2 }}>No {filterStatus} suggestions found.</Typography>
			)}

			{!loading && !error && suggestions.length > 0 && (
				<>
					{/* Batch Actions Section */}
					<Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
						<FormControlLabel
							control={
								<Checkbox
									checked={isSelectAll}
									indeterminate={selectedSuggestions.size > 0 && selectedSuggestions.size < suggestions.length}
									onChange={handleSelectAll}
									disabled={batchActionLoading}
								/>
							}
							label={`Select All (${selectedSuggestions.size}/${suggestions.length})`}
						/>

						{selectedSuggestions.size > 0 && (
							<ButtonGroup variant="outlined" disabled={batchActionLoading}>
								{filterStatus === 'pending' && (
									<>
										<Button
											color="success"
											onClick={handleBatchApprove}
											startIcon={<ThumbUpIcon />}
											disabled={batchActionLoading}
										>
											Approve ({selectedSuggestions.size})
										</Button>
										<Button
											color="error"
											onClick={handleBatchReject}
											startIcon={<ThumbDownIcon />}
											disabled={batchActionLoading}
										>
											Reject ({selectedSuggestions.size})
										</Button>
									</>
								)}
								<Button
									color="error"
									onClick={handleBatchDelete}
									startIcon={<DeleteForeverIcon />}
									disabled={batchActionLoading}
								>
									Delete ({selectedSuggestions.size})
								</Button>
							</ButtonGroup>
						)}

						{batchActionLoading && <CircularProgress size={20} />}
					</Box>

					<TableContainer component={Paper} elevation={2}>
						<Table sx={{ minWidth: 800 }} aria-label="review suggestions table">
						<TableHead>
							<TableRow>
									<TableCell padding="checkbox">
										<Checkbox
											checked={isSelectAll}
											indeterminate={selectedSuggestions.size > 0 && selectedSuggestions.size < suggestions.length}
											onChange={handleSelectAll}
											disabled={batchActionLoading}
										/>
									</TableCell>
								<TableCell>Package Name</TableCell>
								<TableCell>Suggested By</TableCell>
								<TableCell>Submitted</TableCell>
								<TableCell>Status</TableCell>
									<TableCell align="center" sx={{ width: '50px' }}>
										<Tooltip title="Repository URL">
											<CodeIcon fontSize="small" />
										</Tooltip>
									</TableCell>
									<TableCell align="center" sx={{ width: '50px' }}>
										<Tooltip title="Publication URL">
											<ArticleIcon fontSize="small" />
										</Tooltip>
									</TableCell>
									<TableCell align="center" sx={{ width: '50px' }}>
										<Tooltip title="Webserver URL">
											<WebIcon fontSize="small" />
										</Tooltip>
									</TableCell>
									<TableCell align="center" sx={{ width: '50px' }}>
										<Tooltip title="Other Link URL">
											<LinkIcon fontSize="small" />
										</Tooltip>
									</TableCell>
								<TableCell align="right" sx={{ minWidth: '180px' }}>Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{suggestions.map((suggestion) => (
								<TableRow key={suggestion.id} hover sx={{ opacity: actionLoading === suggestion.id ? 0.5 : 1 }}>
									<TableCell padding="checkbox">
										<Checkbox
											checked={selectedSuggestions.has(suggestion.id)}
											onChange={() => handleSelectSuggestion(suggestion.id)}
											disabled={batchActionLoading || actionLoading === suggestion.id}
										/>
									</TableCell>
									<TableCell component="th" scope="row">
										<Tooltip
											title={<PackageTooltipContent suggestion={suggestion} />}
											placement="right"
											componentsProps={{
												tooltip: {
													sx: {
														bgcolor: 'background.paper',
														color: 'text.primary',
														border: '1px solid',
														borderColor: 'divider',
														boxShadow: 3,
														'& .MuiTooltip-arrow': {
															color: 'background.paper',
															'&::before': {
																border: '1px solid',
																borderColor: 'divider',
															},
														},
													},
												},
											}}
											arrow
										>
											<Typography
												sx={{
													cursor: 'pointer',
													fontWeight: 500,
													color: 'primary.main',
													'&:hover': {
														textDecoration: 'underline'
													}
												}}
												onClick={() => handleOpenEditModal(suggestion)}
											>
												{suggestion.package_name}
											</Typography>
										</Tooltip>
									</TableCell>
									<TableCell>{suggestion.suggester_email || 'Anonymous/Error'}</TableCell>
									<TableCell>{new Date(suggestion.created_at).toLocaleDateString()}</TableCell>
									<TableCell>
										<Chip label={suggestion.status} color={getStatusChipColor(suggestion.status)} size="small" />
									</TableCell>
									<TableCell align="center"><URLIcon url={suggestion.repo_url} type="repo" /></TableCell>
									<TableCell align="center"><URLIcon url={suggestion.publication_url} type="publication" isRequired={!suggestion.webserver_url && !suggestion.repo_url && !suggestion.link_url} /></TableCell>
									<TableCell align="center"><URLIcon url={suggestion.webserver_url} type="webserver" /></TableCell>
									<TableCell align="center"><URLIcon url={suggestion.link_url} type="link" /></TableCell>
									<TableCell align="right">
										<Tooltip title="View/Edit Details">
											<span> {/* Span for Tooltip when IconButton is disabled */}
												<IconButton size="small" onClick={() => handleOpenEditModal(suggestion)} disabled={actionLoading === suggestion.id}>
													<EditIcon />
												</IconButton>
											</span>
										</Tooltip>
										{suggestion.status === 'pending' && (
											<>
												<Tooltip title="Approve">
													<span>
														<IconButton size="small" color="success" onClick={() => handleApproveSuggestion(suggestion.id)} sx={{ ml: 0.5 }} disabled={actionLoading === suggestion.id}>
															<ThumbUpIcon />
														</IconButton>
													</span>
												</Tooltip>
												<Tooltip title="Reject">
													<span>
														<IconButton size="small" color="error" onClick={() => openRejectModal(suggestion)} sx={{ ml: 0.5 }} disabled={actionLoading === suggestion.id}>
															<ThumbDownIcon />
														</IconButton>
													</span>
												</Tooltip>
											</>
										)}
										{suggestion.status === 'approved' && (
											<Tooltip title="Add to Database Directly">
												<span>
													<IconButton size="small" color="primary" onClick={() => handleAddPackageDirectly(suggestion)} sx={{ ml: 0.5 }} disabled={actionLoading === suggestion.id}>
														<AddToQueueIcon />
													</IconButton>
												</span>
											</Tooltip>
										)}
										<Tooltip title="Delete Suggestion Permanently">
											<span>
												<IconButton size="small" color="error" onClick={() => handleDeleteSuggestion(suggestion.id, suggestion.package_name)} sx={{ ml: 0.5 }} disabled={actionLoading === suggestion.id}>
													<DeleteForeverIcon />
												</IconButton>
											</span>
										</Tooltip>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
				</>
			)}

			{editingSuggestion && (
				<EditSuggestionModal
					open={isEditModalOpen}
					onClose={handleCloseEditModal}
					suggestion={editingSuggestion}
					onSaveSuccess={handleEditSaveSuccess}
					isAdmin={true}
				/>
			)}

			<Dialog open={isRejectModalOpen} onClose={handleCloseRejectModal} maxWidth="sm" fullWidth>
				<DialogTitle>Reject Suggestion: {selectedSuggestionForReject?.package_name}</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 2 }}>
						Please provide a reason for rejecting this suggestion. This will be visible to the user if they can view their rejected suggestions.
					</DialogContentText>
					<TextField
						autoFocus
						margin="dense"
						id="admin_notes_reject"
						label="Admin Notes (Reason for Rejection)"
						type="text"
						fullWidth
						variant="outlined"
						multiline
						rows={3}
						value={adminNotesForReject}
						onChange={(e) => setAdminNotesForReject(e.target.value)}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseRejectModal}>Cancel</Button>
					<Button
						onClick={() => selectedSuggestionForReject && handleUpdateSuggestionStatus(selectedSuggestionForReject.id, 'rejected', adminNotesForReject)}
						color="error"
						disabled={!adminNotesForReject.trim()}
					>
						Confirm Rejection
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};

export default AdminReviewSuggestionsPage;
