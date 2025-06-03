// src/pages/MySuggestionsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { PackageSuggestion } from '../types';
import {
	Box, Typography, CircularProgress, Paper, Alert, Container,
	Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit'; // Import EditIcon
import DeleteIcon from '@mui/icons-material/Delete';
import EditSuggestionModal from '../components/EditSuggestionModal'; // Import the modal

const MySuggestionsPage: React.FC = () => {
	const navigate = useNavigate();
	const { currentUser, loading: authLoading, isAdmin } = useAuth(); // Get isAdmin
	
	// Stable user ID to prevent unnecessary re-renders due to object reference changes
	const userId = currentUser?.id || null;
	
	const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	// State for the edit modal
	const [editingSuggestion, setEditingSuggestion] = useState<PackageSuggestion | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const fetchSuggestions = useCallback(async () => {
		if (!userId) return;
		setLoading(true);
		setError(null);
		try {
			const { data, error: fetchError } = await supabase
				.from('package_suggestions')
				.select('*')
				.eq('suggested_by_user_id', userId)
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;
			setSuggestions(data || []);
		} catch (err: any) {
			console.error("Error fetching suggestions:", err.message);
			setError(`Failed to load your suggestions: ${err.message}`);
			setSuggestions([]);
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		if (!authLoading && !currentUser) {
			navigate('/login');
		} else if (userId) {
			fetchSuggestions();
		}
	}, [userId, authLoading, navigate, fetchSuggestions]);

	const handleDeleteSuggestion = async (suggestionId: string) => {
		if (!window.confirm("Are you sure you want to delete this pending suggestion? This action cannot be undone.")) return;
		if (!userId) return;

		try {
			const { error: deleteError } = await supabase
				.from('package_suggestions')
				.delete()
				.eq('id', suggestionId)
				.eq('status', 'pending')
				.eq('suggested_by_user_id', userId);

			if (deleteError) throw deleteError;
			setSuggestions(prev => prev.filter((s) => s.id !== suggestionId));
			// Consider adding a success snackbar here
		} catch (err: any) {
			setError(`Failed to delete suggestion: ${err.message}`);
		}
	};

	const handleOpenEditModal = (suggestion: PackageSuggestion) => {
		if ((suggestion.status === 'pending' && suggestion.suggested_by_user_id === userId) || isAdmin) {
			setEditingSuggestion(suggestion);
			setIsEditModalOpen(true);
		} else {
			alert("You can only edit your own suggestions that are still pending.");
		}
	};

	const handleCloseEditModal = () => {
		setEditingSuggestion(null);
		setIsEditModalOpen(false);
	};

	const handleSaveSuccess = () => {
		fetchSuggestions();
		setIsEditModalOpen(false);
		setEditingSuggestion(null);
		// Consider adding a success snackbar here
	};

	const getStatusChipColor = (status: PackageSuggestion['status']) => {
		switch (status) {
			case 'pending': return 'warning';
			case 'approved': return 'success';
			case 'rejected': return 'error';
			case 'added': return 'info'; // Added from previous update, ensure type is consistent
			default: return 'default';
		}
	};

	if (authLoading || loading) {
		return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
	}

	if (error) {
		return <Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
	}
	if (!currentUser) {
		return <Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="info">Please log in to view your suggestions.</Alert></Container>;
	}

	return (
		<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
			<Typography variant="h4" gutterBottom component="h1" sx={{
				mb: 3,
				color: (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
			}}>
				My Package Suggestions
			</Typography>
			{suggestions.length === 0 ? (
				<Typography>You haven't submitted any package suggestions yet.</Typography>
			) : (
				<TableContainer component={Paper} elevation={2}>
					<Table sx={{ minWidth: 650 }} aria-label="my suggestions table">
						<TableHead>
							<TableRow>
								<TableCell>Package Name</TableCell>
								<TableCell>Status</TableCell>
								<TableCell>Submitted</TableCell>
								<TableCell>Reason</TableCell>
								<TableCell>Admin Notes</TableCell>
								<TableCell align="right">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
								{suggestions.map((suggestion) => (
								<TableRow key={suggestion.id} hover>
									<TableCell component="th" scope="row">
										{suggestion.package_name}
									</TableCell>
									<TableCell>
										<Chip label={suggestion.status} color={getStatusChipColor(suggestion.status)} size="small" />
									</TableCell>
									<TableCell>{new Date(suggestion.created_at).toLocaleDateString()}</TableCell>
									<TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										<Tooltip title={suggestion.suggestion_reason || ''}>
											<span>{suggestion.suggestion_reason || '-'}</span>
										</Tooltip>
									</TableCell>
									<TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										<Tooltip title={suggestion.admin_notes || ''}>
											<span>{suggestion.admin_notes || '-'}</span>
										</Tooltip>
									</TableCell>
									<TableCell align="right">
										{/* Edit button: User can edit their own PENDING suggestions. Admin can edit any. */}
										{((suggestion.status === 'pending' && suggestion.suggested_by_user_id === userId) || isAdmin) && (
											<Tooltip title="Edit Suggestion">
												<IconButton
													size="small"
													onClick={() => handleOpenEditModal(suggestion)}
													sx={{ color: 'primary.main' }}
												>
													<EditIcon />
												</IconButton>
											</Tooltip>
										)}
										{/* Delete button: User can delete their own PENDING suggestions */}
										{suggestion.status === 'pending' && suggestion.suggested_by_user_id === userId && (
											<Tooltip title="Delete Suggestion">
												<IconButton size="small" onClick={() => handleDeleteSuggestion(suggestion.id)} sx={{ ml: 1, color: 'error.main' }}>
													<DeleteIcon />
												</IconButton>
											</Tooltip>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}
			{/* Edit Suggestion Modal */}
			{editingSuggestion && (
				<EditSuggestionModal
					open={isEditModalOpen}
					onClose={handleCloseEditModal}
					suggestion={editingSuggestion}
					onSaveSuccess={handleSaveSuccess}
					isAdmin={!!isAdmin} // Pass admin status
				/>
			)}
		</Container>
	);
};

export default MySuggestionsPage;
