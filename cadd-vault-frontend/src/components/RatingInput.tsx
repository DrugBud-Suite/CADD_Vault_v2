// src/components/RatingInput.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
	Box,
	Rating,
	Typography,
	Popover,
	IconButton,
	CircularProgress,
	Tooltip,
	Button,
	Stack,
	Alert
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../context/AuthContext';
import { RatingService, RatingEventEmitter, type RatingUpdateEvent } from '../services/ratingService';

interface RatingInputProps {
	packageId: string;
	initialAverageRating?: number;
	initialRatingsCount?: number;
}

const RatingInput: React.FC<RatingInputProps> = ({
	packageId,
	initialAverageRating = 0,
	initialRatingsCount = 0,
}) => {
	const { currentUser } = useAuth();

	// Local state for this component
	const [averageRating, setAverageRating] = useState(initialAverageRating);
	const [ratingsCount, setRatingsCount] = useState(initialRatingsCount);
	const [userRating, setUserRating] = useState<number | null>(null);
	const [popoverRating, setPopoverRating] = useState<number | null>(null);

	// UI state
	const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Refs to prevent stale closures
	const packageIdRef = useRef(packageId);
	const mountedRef = useRef(true);

	// Update refs when props change
	useEffect(() => {
		packageIdRef.current = packageId;
	}, [packageId]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Initialize component data
	const fetchInitialData = useCallback(async () => {
		if (!currentUser) {
			setUserRating(null);
		return;
	}

	  setLoading(true);
	  setError(null);

	  try {
		// Fetch user's current rating
		const userRatingData = await RatingService.getUserRating(packageId);

		  if (mountedRef.current) {
			  setUserRating(userRatingData?.rating || null);
			  setPopoverRating(userRatingData?.rating || null);
		  }
	  } catch (err: any) {
		  console.error('Error fetching initial rating data:', err);
		  if (mountedRef.current) {
			  setError('Failed to load rating data');
		  }
	  } finally {
		  if (mountedRef.current) {
			  setLoading(false);
		  }
	  }
  }, [currentUser, packageId]);

	// Subscribe to rating updates from other components
	useEffect(() => {
		const unsubscribe = RatingEventEmitter.subscribe((event: RatingUpdateEvent) => {
			if (event.packageId === packageIdRef.current && mountedRef.current) {
				setAverageRating(event.averageRating);
				setRatingsCount(event.ratingsCount);

		  // Update user rating if provided
		  if (event.userRating !== undefined) {
			  setUserRating(event.userRating);
			  setPopoverRating(event.userRating);
		  }
	  }
	});

	  return unsubscribe;
  }, []);

	// Update local state when props change
	useEffect(() => {
	  setAverageRating(initialAverageRating);
	  setRatingsCount(initialRatingsCount);
  }, [initialAverageRating, initialRatingsCount]);

	// Fetch initial data when component mounts or user changes
	useEffect(() => {
		fetchInitialData();
	}, [fetchInitialData]);

	// Event handlers
	const handlePopoverOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
	  if (!currentUser) {
		  return;
	  }
	  setAnchorEl(event.currentTarget);
	  setError(null);
  };

	const handlePopoverClose = () => {
		setAnchorEl(null);
	  setPopoverRating(userRating);
	  setError(null);
  };

	const handleRatingChange = async (
		_event: React.SyntheticEvent,
		newValue: number | null,
	) => {
	  if (!currentUser || newValue === null || submitting) return;

	  setSubmitting(true);
	  setError(null);
	  setPopoverRating(newValue);

	  try {
		const result = await RatingService.upsertRating(packageId, newValue);

		if (mountedRef.current) {
			// Update local state
			setAverageRating(result.average_rating);
			setRatingsCount(result.ratings_count);
			setUserRating(result.user_rating);
			setPopoverRating(result.user_rating);

		  // Emit event for other components
		  RatingEventEmitter.emit({
			  packageId,
			  averageRating: result.average_rating,
			  ratingsCount: result.ratings_count,
			  userRating: result.user_rating
		  });

			// Close popover after successful submission
			setTimeout(() => {
				if (mountedRef.current) {
					handlePopoverClose();
				}
			}, 500);
		}
	} catch (err: any) {
		console.error('Error submitting rating:', err);
		if (mountedRef.current) {
			setError('Failed to submit rating. Please try again.');
			setPopoverRating(userRating); // Revert optimistic update
		}
	} finally {
		if (mountedRef.current) {
			setSubmitting(false);
		}
	}
	};

	const handleDeleteRating = async () => {
		if (!currentUser || !userRating || submitting) return;

		setSubmitting(true);
		setError(null);

	  try {
		  const result = await RatingService.deleteRating(packageId);

		if (mountedRef.current) {
			// Update local state
			setAverageRating(result.average_rating);
			setRatingsCount(result.ratings_count);
			setUserRating(null);
			setPopoverRating(null);

		  // Emit event for other components
		  RatingEventEmitter.emit({
			  packageId,
			  averageRating: result.average_rating,
			  ratingsCount: result.ratings_count,
			  userRating: undefined
		  });

		  // Close popover
		  handlePopoverClose();
	  }
	} catch (err: any) {
		console.error('Error deleting rating:', err);
		if (mountedRef.current) {
			setError('Failed to delete rating. Please try again.');
		}
	} finally {
		  if (mountedRef.current) {
			  setSubmitting(false);
		  }
	  }
  };

	const open = Boolean(anchorEl);
	const id = open ? `rating-popover-${packageId}` : undefined;

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
		  <Tooltip title={currentUser ? "Rate this package" : "Login to rate"}>
			  <span>
				  <IconButton
					  size="small"
					  onClick={handlePopoverOpen}
					  aria-describedby={id}
					  disabled={loading || submitting || !currentUser}
					  sx={{ p: 0.5 }}
				  >
					  {loading || submitting ? (
						  <CircularProgress size={20} />
					  ) : (
						  <StarIcon
							  fontSize="inherit"
							  sx={{
								  color: averageRating > 0 ? 'warning.main' : 'action.disabled'
							  }}
						  />
					  )}
				  </IconButton>
			  </span>
		  </Tooltip>

		  <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '2ch' }}>
			  {averageRating.toFixed(1)}
		  </Typography>

		  <Typography variant="body2" color="text.secondary" sx={{ minWidth: '3ch' }}>
			  ({ratingsCount})
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
			  PaperProps={{
				  sx: { p: 2, minWidth: 200 }
			  }}
		  >
			  <Stack spacing={2} alignItems="center">
				  <Typography variant="subtitle2" color="text.primary">
					  {userRating ? 'Update Your Rating' : 'Rate This Package'}
				  </Typography>

				  {error && (
					  <Alert severity="error" sx={{ width: '100%', py: 0.5 }}>
						  {error}
					  </Alert>
				  )}

				  <Rating
					  name={`rating-${packageId}`}
					  value={popoverRating}
					  onChange={handleRatingChange}
					  precision={1}
					  emptyIcon={<StarBorderIcon fontSize="inherit" />}
					  disabled={submitting}
					  sx={{ fontSize: '1.5rem' }}
				  />

				  {userRating && (
					  <Button
						  variant="outlined"
						  color="error"
						  size="small"
						  startIcon={<DeleteIcon />}
						  onClick={handleDeleteRating}
						  disabled={submitting}
						  sx={{ mt: 1 }}
					  >
						  Remove Rating
					  </Button>
				  )}

				  {submitting && (
					  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						  <CircularProgress size={16} />
						  <Typography variant="caption" color="text.secondary">
							  {userRating ? 'Updating...' : 'Submitting...'}
						  </Typography>
					  </Box>
				  )}
			  </Stack>
		  </Popover>
	  </Box>
  );
};

export default RatingInput;