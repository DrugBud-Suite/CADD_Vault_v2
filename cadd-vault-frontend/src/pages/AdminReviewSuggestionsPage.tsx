// src/pages/AdminReviewSuggestionsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
	Container,
	Typography,
	Box,
	CircularProgress,
	Alert,
	Snackbar,
	Button,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Chip,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	IconButton,
	Tabs,
	Tab,
	Checkbox,
	FormControlLabel,
	ButtonGroup,
	Tooltip,
	Link,
} from '@mui/material';
import {
	CheckCircle as CheckCircleIcon,
	Cancel as CancelIcon,
	Delete as DeleteIcon,
	Edit as EditIcon,
	ThumbUp as ThumbUpIcon,
	ThumbDown as ThumbDownIcon,
	DeleteForever as DeleteForeverIcon,
	AddToQueue as AddToQueueIcon,
	RemoveRedEye as RemoveRedEyeIcon,
	GitHub as GitHubIcon,
	Language as WebIcon,
	Article as ArticleIcon,
} from '@mui/icons-material';
import { supabase, ensureValidSession } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PackageSuggestion } from '../types';
import EditSuggestionModal from '../components/EditSuggestionModal';

// Define PackageType interface if not in types
interface PackageType {
	id: string;
	package_name: string;
}

// Extended PackageSuggestion interface to include all fields
interface ExtendedPackageSuggestion extends PackageSuggestion {
	repo_link?: string | null;
	webserver?: string | null;
	publication?: string | null;
	user_email?: string | null;
	package_id?: string | null;
}

// Add the session retry wrapper
async function withSessionRetry<T>(
	operation: () => Promise<{ data: T | null; error: any }>,
	options: { maxRetries?: number; onRetry?: () => void } = {}
): Promise<{ data: T | null; error: any }> {
	const { maxRetries = 1, onRetry } = options;
	let lastError: any = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const result = await operation();

			// Check if the error is auth-related
			if (result.error &&
				(result.error.message?.includes('JWT') ||
					result.error.message?.includes('token') ||
					result.error.code === 'PGRST301' ||
					result.error.code === '401')) {

				if (attempt < maxRetries) {
					console.log('Auth error detected, refreshing session...');
					onRetry?.();

					// Try to refresh the session
					const { error: refreshError } = await supabase.auth.refreshSession();

					if (refreshError) {
						console.error('Failed to refresh session:', refreshError);
						lastError = refreshError;
						continue;
					}

					// Wait a bit before retrying
					await new Promise(resolve => setTimeout(resolve, 100));
					continue;
				}
			}

			return result;
		} catch (error) {
			lastError = error;
			if (attempt < maxRetries) {
				console.log(`Operation failed, retrying (${attempt + 1}/${maxRetries})...`);
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}
	}

	return { data: null, error: lastError };
}

const AdminReviewSuggestionsPage: React.FC = () => {
	const navigate = useNavigate();
	const { isAdmin, loading: authLoading, currentUser } = useAuth();
	const [suggestions, setSuggestions] = useState<ExtendedPackageSuggestion[]>([]);
	const [existingPackages, setExistingPackages] = useState<PackageType[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [sessionError, setSessionError] = useState<boolean>(false);

	const [selectedSuggestionForReject, setSelectedSuggestionForReject] = useState<ExtendedPackageSuggestion | null>(null);
	const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
	const [adminNotesForReject, setAdminNotesForReject] = useState('');

	const [editingSuggestion, setEditingSuggestion] = useState<ExtendedPackageSuggestion | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'added'>('pending');

	// Batch operations state
	const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
	const [isSelectAll, setIsSelectAll] = useState(false);
	const [batchActionLoading, setBatchActionLoading] = useState(false);

	// Hover popup state
	const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);

	// Add visibility change listener to refresh session
	useEffect(() => {
		const handleVisibilityChange = async () => {
			if (!document.hidden && currentUser) {
				console.log('Tab regained focus, checking session...');
				try {
					await ensureValidSession();
					// If we had a session error, clear it and refresh data
					if (sessionError) {
						setSessionError(false);
						setError(null);
						fetchSuggestions(filterStatus);
					}
				} catch (err) {
					console.error('Session refresh failed:', err);
					setSessionError(true);
					setError('Your session has expired. Please refresh the page to continue.');
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleVisibilityChange);
		};
	}, [currentUser, filterStatus, sessionError]);

	const fetchSuggestions = useCallback(async (status: typeof filterStatus) => {
		setLoading(true);
		setError(null);
		try {
			// Ensure valid session before fetching
			await ensureValidSession();

			// Fetch suggestions with retry
			const { data, error: rpcError } = await withSessionRetry(
				async () => await supabase.rpc('get_suggestions_with_user_email', { filter_status: status }),
				{ onRetry: () => setError('Refreshing session...') }
			);

			if (rpcError) {
				console.error("Supabase RPC fetch error:", rpcError);
				if (rpcError.code === '42804' && rpcError.details?.includes('character varying(255)')) {
					setError(`Database function error: Email column type mismatch. Ensure 'u.email::text' is used.`);
				} else {
					setError(`Failed to fetch suggestions: ${rpcError.message}`);
				}
				setSuggestions([]);
			} else {
				setSuggestions(data || []);
			}

			// Fetch existing packages for duplicate detection
			const { data: existingData, error: existingError } = await withSessionRetry(
				async () => await supabase.from('packages').select('id, package_name')
			);

			if (existingError) {
				console.error("Error fetching existing packages:", existingError);
			} else {
				setExistingPackages(existingData || []);
			}
		} catch (err: any) {
			console.error("Error in fetchSuggestions:", err);
			setError(`An unexpected error occurred: ${err.message}`);
			setSuggestions([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!authLoading && isAdmin) {
			fetchSuggestions(filterStatus);
		}
	}, [authLoading, isAdmin, filterStatus, fetchSuggestions]);

	const handleApproveSuggestion = async (suggestionId: string) => {
		if (!currentUser) return;

		setActionLoading(suggestionId);
		setError(null);

		try {
			await ensureValidSession();

			const { error: updateError } = await withSessionRetry(
				async () => await supabase
					.from('package_suggestions')
					.update({
						status: 'approved',
						reviewed_at: new Date().toISOString(),
						reviewed_by_admin_id: currentUser.id
					})
					.eq('id', suggestionId),
				{
					onRetry: () => setError('Session expired, refreshing...')
				}
			);

			if (updateError) throw updateError;

			setSuccessMessage("Suggestion approved successfully.");
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to approve suggestion');
		} finally {
			setActionLoading(null);
		}
	};

	const handleUpdateSuggestionStatus = async (suggestionId: string, newStatus: 'rejected' | 'added', notes?: string) => {
		if (!currentUser) return;

		setActionLoading(suggestionId);

		try {
			await ensureValidSession();

			const { error: updateError } = await withSessionRetry(
				async () => await supabase
					.from('package_suggestions')
					.update({
						status: newStatus,
						admin_notes: notes,
						reviewed_at: new Date().toISOString(),
						reviewed_by_admin_id: currentUser.id
					})
					.eq('id', suggestionId)
			);

			if (updateError) throw updateError;

			setSuccessMessage(`Suggestion status updated to ${newStatus}.`);
			fetchSuggestions(filterStatus);
			setIsRejectModalOpen(false);
			setSelectedSuggestionForReject(null);
			setAdminNotesForReject('');
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to update suggestion status');
		} finally {
			setActionLoading(null);
		}
	};

	const handleAddPackageDirectly = async (suggestion: ExtendedPackageSuggestion) => {
		if (!currentUser) return;

		setActionLoading(suggestion.id);
		setError(null);
		setSuccessMessage(null);

		try {
			await ensureValidSession();

			const { error } = await withSessionRetry(
				async () => await supabase.rpc('approve_suggestion_with_normalized_data', {
					suggestion_id: suggestion.id,
					approved_by: currentUser.id
				})
			);

			if (error) throw error;

			setSuccessMessage("Package added successfully and suggestion marked as added.");
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to add package');
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
			await ensureValidSession();

			const { error: deleteError } = await withSessionRetry(
				async () => await supabase
					.from('package_suggestions')
					.delete()
					.eq('id', suggestionId)
			);

			if (deleteError) throw deleteError;

			setSuccessMessage(`Suggestion "${packageName}" deleted successfully.`);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to delete suggestion');
		} finally {
			setActionLoading(null);
		}
	};

	// Batch operations handlers
	const handleBatchApprove = async () => {
		if (selectedSuggestions.size === 0) return;
		if (!window.confirm(`Are you sure you want to approve ${selectedSuggestions.size} selected suggestion(s)?`)) return;

		setBatchActionLoading(true);
		setError(null);

		try {
			await ensureValidSession();

			const { error: updateError } = await withSessionRetry(
				async () => await supabase
					.from('package_suggestions')
					.update({
						status: 'approved',
						reviewed_at: new Date().toISOString(),
						reviewed_by_admin_id: currentUser?.id
					})
					.in('id', Array.from(selectedSuggestions))
			);

			if (updateError) throw updateError;

			setSuccessMessage(`${selectedSuggestions.size} suggestion(s) approved successfully!`);
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to approve suggestions');
		} finally {
			setBatchActionLoading(false);
		}
	};

	const handleBatchReject = async () => {
		if (selectedSuggestions.size === 0) return;
		if (!window.confirm(`Are you sure you want to reject ${selectedSuggestions.size} selected suggestion(s)?`)) return;

		setBatchActionLoading(true);
		setError(null);

		try {
			await ensureValidSession();

			const { error: updateError } = await withSessionRetry(
				async () => await supabase
					.from('package_suggestions')
					.update({
						status: 'rejected',
						reviewed_at: new Date().toISOString(),
						reviewed_by_admin_id: currentUser?.id
					})
					.in('id', Array.from(selectedSuggestions))
			);

			if (updateError) throw updateError;

			setSuccessMessage(`${selectedSuggestions.size} suggestion(s) rejected successfully!`);
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to reject suggestions');
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
			await ensureValidSession();

			const { error: deleteError } = await withSessionRetry(
				async () => await supabase
					.from('package_suggestions')
					.delete()
					.in('id', Array.from(selectedSuggestions))
			);

			if (deleteError) throw deleteError;

			setSuccessMessage(`${selectedSuggestions.size} suggestion(s) deleted successfully!`);
			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to delete suggestions');
		} finally {
			setBatchActionLoading(false);
		}
	};

	const handleBatchAddToDatabase = async () => {
		if (selectedSuggestions.size === 0) return;
		if (!window.confirm(`Are you sure you want to add ${selectedSuggestions.size} selected approved suggestion(s) to the database?`)) return;

		setBatchActionLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			await ensureValidSession();

			// Get the selected suggestions
			const selectedSuggestionsList = suggestions.filter(s => selectedSuggestions.has(s.id));

			let successCount = 0;
			let errorCount = 0;
			const errors: string[] = [];

			// Process each suggestion individually using the RPC function
			for (const suggestion of selectedSuggestionsList) {
				try {
					const { error } = await withSessionRetry(
						async () => await supabase.rpc('approve_suggestion_with_normalized_data', {
							suggestion_id: suggestion.id,
							approved_by: currentUser?.id
						})
					);

					if (error) {
						console.error(`Error processing suggestion ${suggestion.package_name}:`, error);
						errors.push(`Failed to add "${suggestion.package_name}": ${error.message}`);
						errorCount++;
					} else {
						successCount++;
					}
				} catch (err: any) {
					console.error(`Error processing suggestion ${suggestion.package_name}:`, err);
					errors.push(`Failed to process "${suggestion.package_name}": ${err.message}`);
					errorCount++;
				}
			}

			// Set appropriate success/error messages
			if (successCount > 0 && errorCount === 0) {
				setSuccessMessage(`Successfully added ${successCount} package(s) to database and marked suggestions as 'Added'.`);
			} else if (successCount > 0 && errorCount > 0) {
				setSuccessMessage(`Added ${successCount} package(s) successfully. ${errorCount} failed.`);
				setError(`Some operations failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
			} else {
				setError(`All operations failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
			}

			setSelectedSuggestions(new Set());
			setIsSelectAll(false);
			fetchSuggestions(filterStatus);
		} catch (err: any) {
			handleDatabaseError(err, 'Failed to batch add packages');
		} finally {
			setBatchActionLoading(false);
		}
	};

	// Helper function to handle database errors
	const handleDatabaseError = (err: any, defaultMessage: string) => {
		console.error(defaultMessage, err);

		if (err.message?.includes('session') || err.message?.includes('JWT') || err.code === 'PGRST301') {
			setSessionError(true);
			setError('Your session has expired. Please refresh the page and try again.');
			// Optionally trigger a reload after a delay
			setTimeout(() => {
				if (window.confirm('Your session has expired. Would you like to refresh the page?')) {
					window.location.reload();
				}
			}, 2000);
		} else {
			setError(`${defaultMessage}: ${err.message}`);
		}
	};

	const openRejectModal = (suggestion: ExtendedPackageSuggestion) => {
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

	const handleOpenEditModal = (suggestion: ExtendedPackageSuggestion) => {
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

	const getStatusChipColor = (status: ExtendedPackageSuggestion['status']) => {
		switch (status) {
			case 'pending': return 'warning';
			case 'approved': return 'success';
			case 'rejected': return 'error';
			case 'added': return 'info';
			default: return 'default';
		}
	};

	// Check for duplicate package names
	const isDuplicate = (packageName: string) => {
		return existingPackages.some(pkg =>
			pkg.package_name.toLowerCase() === packageName.toLowerCase()
		);
	};

	// Render tooltip content for suggestions
	const renderSuggestionTooltip = (suggestion: ExtendedPackageSuggestion) => (
		<Box sx={{ p: 1 }}>
			<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
				{suggestion.package_name}
			</Typography>
			{suggestion.description && (
				<Typography variant="body2" sx={{ mb: 1 }}>
					{suggestion.description}
				</Typography>
			)}
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
				{suggestion.license && (
					<Typography variant="caption">
						License: {suggestion.license}
					</Typography>
				)}
				{suggestion.tags && suggestion.tags.length > 0 && (
					<Typography variant="caption">
						Tags: {suggestion.tags.join(', ')}
					</Typography>
				)}
				{suggestion.folder1 && (
					<Typography variant="caption">
						Folder: {suggestion.folder1} {suggestion.category1 && `> ${suggestion.category1}`}
					</Typography>
				)}
			</Box>
			{suggestion.admin_notes && (
				<Typography variant="caption" sx={{ mt: 1, fontStyle: 'italic' }}>
					Admin notes: {suggestion.admin_notes}
				</Typography>
			)}
		</Box>
	);

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

			{sessionError && (
				<Alert severity="error" sx={{ mb: 2 }}>
					Your session has expired. Please refresh the page to continue working.
					<Button
						size="small"
						onClick={() => window.location.reload()}
						sx={{ ml: 2 }}
					>
						Refresh Now
					</Button>
				</Alert>
			)}

			<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
				<Tabs value={filterStatus} onChange={handleTabChange} aria-label="suggestion status filter">
					<Tab label="Pending" value="pending" />
					<Tab label="Approved" value="approved" />
					<Tab label="Rejected" value="rejected" />
					<Tab label="Added to DB" value="added" />
				</Tabs>
			</Box>

			{loading && <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>}
			{error && !sessionError && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
									disabled={batchActionLoading || sessionError}
								/>
							}
							label={`Select All (${selectedSuggestions.size}/${suggestions.length})`}
						/>

						{selectedSuggestions.size > 0 && (
							<ButtonGroup variant="outlined" disabled={batchActionLoading || sessionError}>
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
								{filterStatus === 'approved' && (
									<Button
										color="primary"
										onClick={handleBatchAddToDatabase}
										startIcon={<AddToQueueIcon />}
										disabled={batchActionLoading}
									>
										Add to Database ({selectedSuggestions.size})
									</Button>
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
											disabled={batchActionLoading || sessionError}
										/>
									</TableCell>
									<TableCell>Package Name</TableCell>
									<TableCell>Description</TableCell>
									<TableCell>Links</TableCell>
									<TableCell>Suggested By</TableCell>
									<TableCell>Status</TableCell>
									<TableCell align="center">Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{suggestions.map((suggestion) => (
									<TableRow
										key={suggestion.id}
										onMouseEnter={() => setHoveredSuggestion(suggestion.id)}
										onMouseLeave={() => setHoveredSuggestion(null)}
									>
										<TableCell padding="checkbox">
											<Checkbox
												checked={selectedSuggestions.has(suggestion.id)}
												onChange={() => handleSelectSuggestion(suggestion.id)}
												disabled={batchActionLoading || sessionError}
											/>
										</TableCell>
										<TableCell>
											<Box>
												<Tooltip 
													title={renderSuggestionTooltip(suggestion)}
													open={hoveredSuggestion === suggestion.id}
													placement="right"
													arrow
												>
													<Link
														component="button"
														variant="body1"
														onClick={() => handleOpenEditModal(suggestion)}
														sx={{ 
															fontWeight: 'bold',
															textAlign: 'left',
															cursor: 'pointer',
															'&:hover': {
																textDecoration: 'underline'
															}
														}}
													>
														{suggestion.package_name}
													</Link>
												</Tooltip>
												{isDuplicate(suggestion.package_name) && (
													<Chip
														label="Duplicate"
														color="error"
														size="small"
														sx={{ mt: 0.5, ml: 1 }}
													/>
												)}
												{suggestion.license && (
													<Typography variant="caption" color="text.secondary" display="block">
														License: {suggestion.license}
													</Typography>
												)}
											</Box>
										</TableCell>
										<TableCell sx={{ maxWidth: 300 }}>
											<Typography variant="body2" sx={{
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												display: '-webkit-box',
												WebkitLineClamp: 3,
												WebkitBoxOrient: 'vertical',
											}}>
												{suggestion.description || 'No description provided'}
											</Typography>
										</TableCell>
										<TableCell>
											<Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
												{suggestion.repo_link && (
													<Tooltip title="GitHub Repository">
														<IconButton
															size="small"
															href={suggestion.repo_link}
															target="_blank"
															rel="noopener noreferrer"
															sx={{ p: 0.5 }}
														>
															<GitHubIcon fontSize="small" />
														</IconButton>
													</Tooltip>
												)}
												{suggestion.webserver && (
													<Tooltip title="Website">
														<IconButton
															size="small"
															href={suggestion.webserver}
															target="_blank"
															rel="noopener noreferrer"
															sx={{ p: 0.5 }}
														>
															<WebIcon fontSize="small" />
														</IconButton>
													</Tooltip>
												)}
												{suggestion.publication && (
													<Tooltip title="Publication">
														<IconButton
															size="small"
															href={suggestion.publication}
															target="_blank"
															rel="noopener noreferrer"
															sx={{ p: 0.5 }}
														>
															<ArticleIcon fontSize="small" />
														</IconButton>
													</Tooltip>
												)}
												{!suggestion.repo_link && !suggestion.webserver && !suggestion.publication && (
													<Typography variant="caption" color="text.secondary">
														No links provided
													</Typography>
												)}
											</Box>
										</TableCell>
										<TableCell>
											<Typography variant="caption">
												{suggestion.user_email || 'Anonymous'}
											</Typography>
											<br />
											<Typography variant="caption" color="text.secondary">
												{new Date(suggestion.created_at).toLocaleDateString()}
											</Typography>
										</TableCell>
										<TableCell>
											<Chip
												label={suggestion.status}
												color={getStatusChipColor(suggestion.status)}
												size="small"
											/>
										</TableCell>
										<TableCell align="center">
											<Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
												{/* View Package (if already added) */}
												{suggestion.status === 'added' && suggestion.package_id && (
													<IconButton
														size="small"
														color="info"
														onClick={() => navigate(`/package/${encodeURIComponent(suggestion.package_id!)}`)}
														title="View Package"
													>
														<RemoveRedEyeIcon fontSize="small" />
													</IconButton>
												)}

												{/* Edit */}
												<IconButton
													size="small"
													color="primary"
													onClick={() => handleOpenEditModal(suggestion)}
													disabled={actionLoading === suggestion.id || sessionError}
													title="Edit Suggestion"
												>
													<EditIcon fontSize="small" />
												</IconButton>

												{/* Approve (only for pending) */}
												{suggestion.status === 'pending' && (
													<IconButton
														size="small"
														color="success"
														onClick={() => handleApproveSuggestion(suggestion.id)}
														disabled={actionLoading === suggestion.id || isDuplicate(suggestion.package_name) || sessionError}
														title={isDuplicate(suggestion.package_name) ? "Cannot approve duplicate package" : "Approve"}
													>
														{actionLoading === suggestion.id ? (
															<CircularProgress size={20} />
														) : (
															<CheckCircleIcon fontSize="small" />
														)}
													</IconButton>
												)}

												{/* Reject (only for pending) */}
												{suggestion.status === 'pending' && (
													<IconButton
														size="small"
														color="error"
														onClick={() => openRejectModal(suggestion)}
														disabled={actionLoading === suggestion.id || sessionError}
														title="Reject"
													>
														<CancelIcon fontSize="small" />
													</IconButton>
												)}

												{/* Add to Database (only for approved) */}
												{suggestion.status === 'approved' && (
													<IconButton
														size="small"
														color="primary"
														onClick={() => handleAddPackageDirectly(suggestion)}
														disabled={actionLoading === suggestion.id || isDuplicate(suggestion.package_name) || sessionError}
														title={isDuplicate(suggestion.package_name) ? "Cannot add duplicate package" : "Add to Database"}
													>
														{actionLoading === suggestion.id ? (
															<CircularProgress size={20} />
														) : (
															<AddToQueueIcon fontSize="small" />
														)}
													</IconButton>
												)}

												{/* Delete */}
												<IconButton
													size="small"
													color="error"
													onClick={() => handleDeleteSuggestion(suggestion.id, suggestion.package_name)}
													disabled={actionLoading === suggestion.id || sessionError}
													title="Delete Suggestion"
												>
													{actionLoading === suggestion.id ? (
														<CircularProgress size={20} />
													) : (
														<DeleteIcon fontSize="small" />
													)}
												</IconButton>
											</Box>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				</>
			)}

			{/* Reject Modal */}
			<Dialog
				open={isRejectModalOpen}
				onClose={handleCloseRejectModal}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Reject Suggestion</DialogTitle>
				<DialogContent>
					<Typography variant="body2" sx={{ mb: 2 }}>
						Are you sure you want to reject the suggestion for "{selectedSuggestionForReject?.package_name}"?
					</Typography>
					<TextField
						fullWidth
						multiline
						rows={3}
						label="Admin Notes (Optional)"
						value={adminNotesForReject}
						onChange={(e) => setAdminNotesForReject(e.target.value)}
						placeholder="Provide a reason for rejection..."
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseRejectModal}>Cancel</Button>
					<Button
						color="error"
						variant="contained"
						onClick={() => {
							if (selectedSuggestionForReject) {
								handleUpdateSuggestionStatus(selectedSuggestionForReject.id, 'rejected', adminNotesForReject);
							}
						}}
						disabled={actionLoading === selectedSuggestionForReject?.id || sessionError}
					>
						Reject
					</Button>
				</DialogActions>
			</Dialog>

			{/* Edit Suggestion Modal */}
			{editingSuggestion && (
				<EditSuggestionModal
					open={isEditModalOpen}
					suggestion={editingSuggestion}
					onClose={handleCloseEditModal}
					onSaveSuccess={handleEditSaveSuccess}
					isAdmin={isAdmin}
				/>
			)}
		</Container>
	);
};

export default AdminReviewSuggestionsPage;