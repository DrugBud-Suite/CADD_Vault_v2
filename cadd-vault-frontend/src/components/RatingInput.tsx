// src/components/RatingInput.tsx
import React, { useState, useRef } from 'react';
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
import { RatingService, RatingEventEmitter } from '../services/ratingService';

interface RatingInputProps {
	packageId: string;
	averageRating?: number;
	ratingsCount?: number;
	userRating?: number | null;
	userRatingId?: string | null;
}

const RatingInput: React.FC<RatingInputProps> = ({
	packageId,
	averageRating = 0,
	ratingsCount = 0,
	userRating = null,
}) => {
	const { currentUser } = useAuth();

	// Local state for UI interactions only
	const [popoverRating, setPopoverRating] = useState<number | null>(userRating);
	const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Ref to prevent stale closures
	const mountedRef = useRef(true);

	// Cleanup on unmount
	React.useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Update popover rating when userRating prop changes
	React.useEffect(() => {
		setPopoverRating(userRating);
	}, [userRating]);

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
			// Update local popover state
			setPopoverRating(result.user_rating);

			// Emit event for other components to update their data
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
			// Update local popover state
			setPopoverRating(null);

			// Emit event for other components to update their data
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
						disabled={submitting || !currentUser}
					  sx={{ p: 0.5 }}
				  >
						{submitting ? (
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