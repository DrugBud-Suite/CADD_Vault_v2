import React, { useState, useEffect } from 'react';
import {
	Box,
	Rating,
	Typography,
	Popover,
	IconButton,
	CircularProgress,
	Tooltip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook
import { supabase } from '../supabase'; // Assuming supabase client is exported from here

interface RatingInputProps {
	packageId: string;
	initialAverageRating: number;
	initialRatingsCount: number;
}

const RatingInput: React.FC<RatingInputProps> = ({
	packageId,
	initialAverageRating,
	initialRatingsCount,
}) => {
	const { currentUser } = useAuth(); // Use the hook and get currentUser
	const [averageRating, setAverageRating] = useState(initialAverageRating);
	const [ratingsCount, setRatingsCount] = useState(initialRatingsCount);
	const [userRating, setUserRating] = useState<number | null>(null);
	const [loadingUserRating, setLoadingUserRating] = useState(false);
	const [submittingRating, setSubmittingRating] = useState(false);
	const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
	const [popoverRating, setPopoverRating] = useState<number | null>(null);

	const fetchUserRating = async () => {
		if (!currentUser) return; // Check currentUser
		setLoadingUserRating(true);
		try {
			// Use limit(1) instead of single() to avoid potential 406 errors with RLS
			const { data, error } = await supabase
				.from('ratings')
				.select('rating')
				.eq('user_id', currentUser.id) // Use currentUser.id
				.eq('package_id', packageId)
				.limit(1); // Fetch max 1 row

			if (error) {
				console.error('Error fetching user rating:', error);
			} else if (data && data.length > 0) {
				// Handle array result
				setUserRating(data[0].rating);
				setPopoverRating(data[0].rating);
			} else {
				setUserRating(null);
				setPopoverRating(null);
			}
		} catch (err) {
			console.error('Unexpected error fetching user rating:', err);
		} finally {
			setLoadingUserRating(false);
		}
	};

	// Function to fetch the latest average rating and count
	const fetchAggregatedRating = async () => {
		try {
			const { data, error } = await supabase
				.from('packages')
				.select('average_rating, ratings_count')
				.eq('id', packageId)
				.limit(1);

			if (error) {
				console.error('Error fetching aggregated rating:', error);
			} else if (data && data.length > 0) {
				// Update local state with values from the database
				const newAverageRating = data[0].average_rating ?? 0;
				const newRatingsCount = data[0].ratings_count ?? 0;

				setAverageRating(newAverageRating);
				setRatingsCount(newRatingsCount);

				// Create and dispatch a custom event to notify all components about the rating change
				const ratingUpdateEvent = new CustomEvent('package-rating-updated', {
					detail: {
						packageId,
						newAverageRating,
						newRatingsCount
					},
					bubbles: true,
					cancelable: false,
					composed: true // Allows the event to pass through shadow DOM boundaries if needed
				});

				// Dispatch the event from the document object to ensure global visibility
				document.dispatchEvent(ratingUpdateEvent);
				console.log(`Rating update event dispatched for package ${packageId}`);
			}
		} catch (err) {
			console.error('Unexpected error fetching aggregated rating:', err);
		}
	};


	useEffect(() => {
		if (currentUser) { // Check currentUser
			fetchUserRating();
		} else {
			setUserRating(null); // Reset user rating if logged out
			setPopoverRating(null);
		}
		// Fetch initial aggregated rating regardless of user state
		fetchAggregatedRating();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser, packageId]); // Rerun when currentUser or packageId changes

	const handlePopoverOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (!currentUser) { // Check currentUser
			// Optionally show login prompt or disable interaction
			console.log('User must be logged in to rate.');
			return;
		}
		setAnchorEl(event.currentTarget);
		// Set initial popover rating to user's current rating or null
		setPopoverRating(userRating);
	};

	const handlePopoverClose = () => {
		setAnchorEl(null);
	};

	const handleRatingChange = async (
		_event: React.SyntheticEvent,
		newValue: number | null,
	) => {
		if (!currentUser || newValue === null) return; // Check currentUser

		setSubmittingRating(true);
		setPopoverRating(newValue); // Optimistically update popover UI

		try {
			// Check if user already has a rating (for upsert logic)
			// Use limit(1) instead of single() to avoid potential 406 errors with RLS
			const { data: existingRatingData, error: fetchError } = await supabase
				.from('ratings')
				.select('id')
				.eq('user_id', currentUser.id) // Use currentUser.id
				.eq('package_id', packageId)
				.limit(1);

			// Extract the first rating (if any) from the array result
			const existingRating = existingRatingData && existingRatingData.length > 0 ? existingRatingData[0] : null;

			if (fetchError) {
				throw fetchError; // Throw if there's any error
			}

			const { error: upsertError } = await supabase.from('ratings').upsert({
				id: existingRating?.id, // Provide id for update, undefined for insert
				user_id: currentUser.id, // Use currentUser.id
				package_id: packageId,
				rating: newValue,
				created_at: existingRating ? undefined : new Date().toISOString(), // Only set created_at on insert
			});


			if (upsertError) {
				console.error('Error submitting rating:', upsertError);
				setPopoverRating(userRating); // Revert optimistic update on error
			} else {
				// Update local state on success
				setUserRating(newValue);

				// Close popover immediately for better UX
				handlePopoverClose();

				// Add a slight delay to allow the database trigger to update the aggregated rating
				setTimeout(async () => {
					// Fetch the updated rating data from the server
					// This ensures we get the correct aggregated rating that accounts for this rating
					await fetchAggregatedRating();
				}, 200);
			}
		} catch (err) {
			console.error('Unexpected error submitting rating:', err);
			setPopoverRating(userRating); // Revert optimistic update on error
		} finally {
			setSubmittingRating(false);
		}
	};

	const open = Boolean(anchorEl);
	const id = open ? `rating-popover-${packageId}` : undefined;

	const displayRating = averageRating ?? 0; // Use 0 if averageRating is null/undefined
	const displayCount = ratingsCount ?? 0; // Use 0 if ratingsCount is null/undefined

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
			{/* Wrap IconButton in a span for Tooltip when disabled */}
			<Tooltip title={currentUser ? "Rate this package" : "Login to rate"}>
				<span> {/* Wrapper span */}
					<IconButton
						size="small"
						onClick={handlePopoverOpen}
						aria-describedby={id}
						disabled={loadingUserRating || submittingRating || !currentUser} // Also disable if not logged in
						sx={{ p: 0.5 }} // Add some padding
					>
						{loadingUserRating || submittingRating ? (
							<CircularProgress size={20} />
						) : (
							<StarIcon fontSize="inherit" sx={{ color: displayRating > 0 ? 'warning.main' : 'action.disabled' }} />
						)}
					</IconButton>
				</span>
			</Tooltip>
			<Typography variant="body2" sx={{ fontWeight: 'medium' }}>
				{displayRating.toFixed(1)}
			</Typography>
			<Typography variant="body2" color="text.secondary">
				({displayCount})
			</Typography>

			<Popover
				id={id}
				open={open}
				anchorEl={anchorEl}
				onClose={handlePopoverClose}
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'center',
				}}
				transformOrigin={{
					vertical: 'top',
					horizontal: 'center',
				}}
			>
				<Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<Typography variant="subtitle2" gutterBottom sx={{ color: (theme) => theme.palette.text.primary }}>Your Rating</Typography>
					<Rating
						name={`rating-${packageId}`}
						value={popoverRating}
						onChange={handleRatingChange}
						precision={1} // Allow only whole stars
						emptyIcon={<StarBorderIcon fontSize="inherit" />}
						disabled={submittingRating}
					/>
					{submittingRating && <CircularProgress size={20} sx={{ mt: 1 }} />}
				</Box>
			</Popover>
		</Box>
	);
};

export default RatingInput;