// src/pages/MySuggestionsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { PackageSuggestion } from '../types';
import {
	Box, Typography, CircularProgress, Paper, Alert, Container, // Added Container
	Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip
} from '@mui/material';
// import EditIcon from '@mui/icons-material/Edit'; // Edit functionality not implemented yet
import DeleteIcon from '@mui/icons-material/Delete';
// import VisibilityIcon from '@mui/icons-material/Visibility'; // View functionality not implemented yet

const MySuggestionsPage: React.FC = () => {
	const navigate = useNavigate();
	const { currentUser, loading: authLoading } = useAuth();
	const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const fetchSuggestions = useCallback(async () => {
		if (!currentUser) return;
		setLoading(true);
		setError(null);
		try {
			const { data, error: fetchError } = await supabase
				.from('package_suggestions')
				.select('*') // You might want to select specific columns or join user email here
				.eq('suggested_by_user_id', currentUser.id)
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;
			setSuggestions(data || []);
		} catch (err: any) {
			console.error("Error fetching suggestions:", err.message);
			setError(`Failed to load your suggestions: ${err.message}`);
		} finally {
			setLoading(false);
		}
	}, [currentUser]); // Dependency: currentUser

	useEffect(() => {
		if (!authLoading && !currentUser) {
			navigate('/login'); // Or show a message to login
		} else if (currentUser) {
			fetchSuggestions();
		}
	}, [currentUser, authLoading, navigate, fetchSuggestions]);

	const handleDeleteSuggestion = async (suggestionId: string) => {
		if (!window.confirm("Are you sure you want to delete this pending suggestion? This action cannot be undone.")) return;
		try {
			const { error: deleteError } = await supabase
				.from('package_suggestions')
				.delete()
				.eq('id', suggestionId)
				.eq('status', 'pending'); // Ensure only pending can be deleted by user

			if (deleteError) throw deleteError;
			setSuggestions(prev => prev.filter((s: PackageSuggestion) => s.id !== suggestionId)); // Explicitly type 's'
			// TODO: Show success message (e.g., using a Snackbar)
		} catch (err: any) {
			setError(`Failed to delete suggestion: ${err.message}`);
		}
	};

	const getStatusChipColor = (status: PackageSuggestion['status']) => {
		switch (status) {
			case 'pending': return 'warning';
			case 'approved': return 'success';
			case 'rejected': return 'error';
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
							{suggestions.map((suggestion: PackageSuggestion) => ( // Explicitly type 'suggestion'
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
										{suggestion.status === 'pending' && (
											<>
												<Tooltip title="Delete Suggestion">
													<IconButton size="small" onClick={() => handleDeleteSuggestion(suggestion.id)} sx={{ ml: 1, color: 'error.main' }}>
														<DeleteIcon />
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
		</Container>
	);
};

export default MySuggestionsPage;
