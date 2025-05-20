// src/pages/AdminReviewSuggestionsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { PackageSuggestion, Package as PackageType } from '../types'; // Renamed Package to PackageType
import {
	Box, Typography, CircularProgress, Paper, Alert, Container,
	Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
	Button, IconButton, Tooltip, Dialog, DialogActions, DialogContent,
	DialogContentText, DialogTitle, TextField, Tabs, Tab, Grid, Link as MuiLink
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import VisibilityIcon from '@mui/icons-material/Visibility';

const isValidUrl = (urlString: string | undefined | null): boolean => {
	if (!urlString) return false;
	try {
		const url = new URL(urlString);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (e) {
		return false;
	}
};

const URLValidityIcon: React.FC<{ url: string | undefined | null, isRequired?: boolean }> = ({ url, isRequired = false }) => {
	if (!url && !isRequired) return <HelpOutlineIcon color="disabled" fontSize="small" />;
	if (!url && isRequired) return <CancelIcon color="error" fontSize="small" />;
	if (isValidUrl(url)) return <CheckCircleIcon color="success" fontSize="small" />;
	return <CancelIcon color="error" fontSize="small" />;
};


const AdminReviewSuggestionsPage: React.FC = () => {
	const navigate = useNavigate();
	const { isAdmin, loading: authLoading, currentUser } = useAuth();
	const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedSuggestion, setSelectedSuggestion] = useState<PackageSuggestion | null>(null);
	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
	const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
	const [adminNotes, setAdminNotes] = useState('');
	const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

	const fetchSuggestions = useCallback(async (status: 'pending' | 'approved' | 'rejected') => {
		setLoading(true);
		setError(null);
		try {
			// Corrected select statement:
			// We are selecting from 'package_suggestions'.
			// 'suggested_by_user_id' is the FK column in 'package_suggestions'
			// that references the 'auth.users' table (implicitly named 'users' by PostgREST conventions).
			// So, we use 'suggested_by_user_id(email)' to fetch the email from the related user.
			// We can alias this embedded object as 'suggester'.
			const { data, error: fetchError } = await supabase
				.from('package_suggestions')
				.select(`
                    *,
                    suggester:suggested_by_user_id ( email )
                `)
				.eq('status', status)
				.order('created_at', { ascending: false });

			if (fetchError) {
				// Log the detailed error from Supabase
				console.error("Supabase fetch error:", fetchError);
				throw fetchError;
			}

			// The 'suggester' alias will contain the joined user object { email: '...' }
			const suggestionsWithEmail = data?.map(s => ({
				...s,
				suggester_email: (s.suggester as any)?.email || 'Anonymous/Error fetching email'
			})) || [];

			setSuggestions(suggestionsWithEmail);

		} catch (err: any) {
			console.error("Error fetching suggestions:", err.message); // This will now show the Supabase error message
			setError(`Failed to load suggestions: ${err.message}`);
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

	const handleUpdateStatus = async (suggestionId: string, newStatus: 'approved' | 'rejected', notes?: string) => {
		if (!currentUser) return;
		try {
			const { error: updateError } = await supabase
				.from('package_suggestions')
				.update({
					status: newStatus,
					admin_notes: notes || selectedSuggestion?.admin_notes,
					reviewed_at: new Date().toISOString(),
					reviewed_by_admin_id: currentUser.id
				})
				.eq('id', suggestionId);

			if (updateError) throw updateError;

			if (newStatus === 'approved') {
				const approvedSuggestion = suggestions.find(s => s.id === suggestionId);
				if (approvedSuggestion) {
					const packageDataForForm: Partial<PackageType> = { // Use PackageType alias
						package_name: approvedSuggestion.package_name,
						description: approvedSuggestion.description,
						publication: approvedSuggestion.publication_url,
						webserver: approvedSuggestion.webserver_url,
						repo_link: approvedSuggestion.repo_url,
						link: approvedSuggestion.link_url,
						license: approvedSuggestion.license,
						tags: approvedSuggestion.tags,
						folder1: approvedSuggestion.folder1,
						category1: approvedSuggestion.category1,
					};
					navigate('/add-package', { state: { suggestionData: packageDataForForm, approvedSuggestionId: suggestionId } });
				}
			} else {
				fetchSuggestions(filterStatus);
			}
			setIsRejectModalOpen(false);
			setSelectedSuggestion(null);

		} catch (err: any) {
			setError(`Failed to update suggestion status: ${err.message}`);
		}
	};

	const openDetailsModal = (suggestion: PackageSuggestion) => {
		setSelectedSuggestion(suggestion);
		setIsDetailsModalOpen(true);
	};

	const openRejectModal = (suggestion: PackageSuggestion) => {
		setSelectedSuggestion(suggestion);
		setAdminNotes(suggestion.admin_notes || '');
		setIsRejectModalOpen(true);
	};

	const handleTabChange = (_event: React.SyntheticEvent, newValue: 'pending' | 'approved' | 'rejected') => {
		setFilterStatus(newValue);
	};

	const getStatusChipColor = (status: PackageSuggestion['status']) => {
		switch (status) {
			case 'pending': return 'warning';
			case 'approved': return 'success';
			case 'rejected': return 'error';
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

			<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
				<Tabs value={filterStatus} onChange={handleTabChange} aria-label="suggestion status filter">
					<Tab label="Pending" value="pending" />
					<Tab label="Approved" value="approved" />
					<Tab label="Rejected" value="rejected" />
				</Tabs>
			</Box>

			{loading && <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>}
			{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

			{!loading && !error && suggestions.length === 0 && (
				<Typography sx={{ mt: 2 }}>No {filterStatus} suggestions found.</Typography>
			)}

			{!loading && !error && suggestions.length > 0 && (
				<TableContainer component={Paper} elevation={2}>
					<Table sx={{ minWidth: 900 }} aria-label="review suggestions table">
						<TableHead>
							<TableRow>
								<TableCell>Package Name</TableCell>
								<TableCell>Suggested By</TableCell>
								<TableCell>Submitted</TableCell>
								<TableCell>Status</TableCell>
								<TableCell>Repo URL</TableCell>
								<TableCell>Publication URL</TableCell>
								<TableCell>Webserver URL</TableCell>
								<TableCell>Other Link</TableCell>
								<TableCell align="right">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{suggestions.map((suggestion) => (
								<TableRow key={suggestion.id} hover>
									<TableCell component="th" scope="row">
										{suggestion.package_name}
									</TableCell>
									<TableCell>{suggestion.suggester_email}</TableCell> {/* Use the mapped suggester_email */}
									<TableCell>{new Date(suggestion.created_at).toLocaleDateString()}</TableCell>
									<TableCell>
										<Chip label={suggestion.status} color={getStatusChipColor(suggestion.status)} size="small" />
									</TableCell>
									<TableCell><URLValidityIcon url={suggestion.repo_url} /></TableCell>
									<TableCell><URLValidityIcon url={suggestion.publication_url} isRequired /></TableCell>
									<TableCell><URLValidityIcon url={suggestion.webserver_url} /></TableCell>
									<TableCell><URLValidityIcon url={suggestion.link_url} /></TableCell>
									<TableCell align="right">
										<Tooltip title="View Details">
											<IconButton size="small" onClick={() => openDetailsModal(suggestion)}>
												<VisibilityIcon />
											</IconButton>
										</Tooltip>
										{suggestion.status === 'pending' && (
											<>
												<Tooltip title="Approve">
													<IconButton size="small" color="success" onClick={() => handleUpdateStatus(suggestion.id, 'approved')} sx={{ ml: 1 }}>
														<ThumbUpIcon />
													</IconButton>
												</Tooltip>
												<Tooltip title="Reject">
													<IconButton size="small" color="error" onClick={() => openRejectModal(suggestion)} sx={{ ml: 1 }}>
														<ThumbDownIcon />
													</IconButton>
												</Tooltip>
											</>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			{/* Details Modal */}
			<Dialog open={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} maxWidth="md" fullWidth>
				<DialogTitle>Suggestion Details: {selectedSuggestion?.package_name}</DialogTitle>
				<DialogContent dividers>
					{selectedSuggestion && (
						<Grid container spacing={2}>
							<Grid item xs={12} sm={6}>
								<Typography variant="subtitle2" gutterBottom>Package Name:</Typography>
								<Typography>{selectedSuggestion.package_name}</Typography>
							</Grid>
							<Grid item xs={12} sm={6}>
								<Typography variant="subtitle2" gutterBottom>Status:</Typography>
								<Chip label={selectedSuggestion.status} color={getStatusChipColor(selectedSuggestion.status)} size="small" />
							</Grid>
							<Grid item xs={12}>
								<Typography variant="subtitle2" gutterBottom>Description:</Typography>
								<Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedSuggestion.description || '-'}</Typography>
							</Grid>
							<Grid item xs={12} sm={6}><Typography variant="subtitle2">Folder:</Typography><Typography>{selectedSuggestion.folder1 || '-'}</Typography></Grid>
							<Grid item xs={12} sm={6}><Typography variant="subtitle2">Category:</Typography><Typography>{selectedSuggestion.category1 || '-'}</Typography></Grid>
							<Grid item xs={12} sm={6}><Typography variant="subtitle2">License:</Typography><Typography>{selectedSuggestion.license || '-'}</Typography></Grid>
							<Grid item xs={12} sm={6}>
								<Typography variant="subtitle2" gutterBottom>Tags:</Typography>
								<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
									{selectedSuggestion.tags?.map(tag => <Chip key={tag} label={tag} size="small" />) || '-'}
								</Box>
							</Grid>
							<Grid item xs={12}><Typography variant="subtitle2">Reason for Suggestion:</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedSuggestion.suggestion_reason || '-'}</Typography></Grid>
							<Grid item xs={12}><Typography variant="subtitle2">Repo URL:</Typography><MuiLink href={selectedSuggestion.repo_url} target="_blank" rel="noopener">{selectedSuggestion.repo_url || '-'}</MuiLink> <URLValidityIcon url={selectedSuggestion.repo_url} /></Grid>
							<Grid item xs={12}><Typography variant="subtitle2">Publication URL:</Typography><MuiLink href={selectedSuggestion.publication_url} target="_blank" rel="noopener">{selectedSuggestion.publication_url || '-'}</MuiLink> <URLValidityIcon url={selectedSuggestion.publication_url} isRequired /></Grid>
							<Grid item xs={12}><Typography variant="subtitle2">Webserver URL:</Typography><MuiLink href={selectedSuggestion.webserver_url} target="_blank" rel="noopener">{selectedSuggestion.webserver_url || '-'}</MuiLink> <URLValidityIcon url={selectedSuggestion.webserver_url} /></Grid>
							<Grid item xs={12}><Typography variant="subtitle2">Other Link URL:</Typography><MuiLink href={selectedSuggestion.link_url} target="_blank" rel="noopener">{selectedSuggestion.link_url || '-'}</MuiLink> <URLValidityIcon url={selectedSuggestion.link_url} /></Grid>
							<Grid item xs={12} sm={6}><Typography variant="subtitle2">Suggested By:</Typography><Typography>{selectedSuggestion.suggester_email}</Typography></Grid> {/* Use mapped suggester_email */}
							<Grid item xs={12} sm={6}><Typography variant="subtitle2">Submission Date:</Typography><Typography>{new Date(selectedSuggestion.created_at).toLocaleString()}</Typography></Grid>
							{selectedSuggestion.status !== 'pending' && (
								<>
									<Grid item xs={12}><Typography variant="subtitle2">Admin Notes:</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedSuggestion.admin_notes || '-'}</Typography></Grid>
									<Grid item xs={12} sm={6}><Typography variant="subtitle2">Reviewed At:</Typography><Typography>{selectedSuggestion.reviewed_at ? new Date(selectedSuggestion.reviewed_at).toLocaleString() : '-'}</Typography></Grid>
								</>
							)}
						</Grid>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
				</DialogActions>
			</Dialog>

			{/* Reject Modal */}
			<Dialog open={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} maxWidth="sm" fullWidth>
				<DialogTitle>Reject Suggestion: {selectedSuggestion?.package_name}</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 2 }}>
						Please provide a reason for rejecting this suggestion (optional). This will be visible to the user.
					</DialogContentText>
					<TextField
						autoFocus
						margin="dense"
						id="admin_notes"
						label="Admin Notes (Reason for Rejection)"
						type="text"
						fullWidth
						variant="outlined"
						multiline
						rows={3}
						value={adminNotes}
						onChange={(e) => setAdminNotes(e.target.value)}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
					<Button
						onClick={() => selectedSuggestion && handleUpdateStatus(selectedSuggestion.id, 'rejected', adminNotes)}
						color="error"
					>
						Confirm Rejection
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};

export default AdminReviewSuggestionsPage;
