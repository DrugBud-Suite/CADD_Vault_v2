// src/components/RatingInput.tsx
import React, { useState } from 'react';
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
import { usePackageRating, useUpsertRating, useDeleteRating } from '../hooks/queries/useRatings';

interface RatingInputProps {
	packageId: string;
}

const RatingInput: React.FC<RatingInputProps> = ({
	packageId,
}) => {
	const { currentUser } = useAuth();

	// React Query hooks
	const { data: ratingData, isLoading } = usePackageRating(packageId);
	const upsertRating = useUpsertRating();
	const deleteRating = useDeleteRating();

	// Extract rating data
	const averageRating = ratingData?.average_rating || 0;
	const ratingsCount = ratingData?.ratings_count || 0;
	const userRating = ratingData?.user_rating || null;

	// Local state for UI interactions only
	const [popoverRating, setPopoverRating] = useState<number | null>(userRating);
	const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Update popover rating when userRating changes
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
	  if (!currentUser || newValue === null || upsertRating.isPending) return;

	  setError(null);
	  setPopoverRating(newValue);

	  try {
		await upsertRating.mutateAsync({
			packageId,
			rating: newValue
		});

		// Close popover after successful submission
		setTimeout(() => {
			handlePopoverClose();
		}, 500);
	} catch (err) {
		console.error('Error submitting rating:', err);
		setError('Failed to submit rating. Please try again.');
		setPopoverRating(userRating); // Revert optimistic update
	}
	};

	const handleDeleteRating = async () => {
		if (!currentUser || !userRating || deleteRating.isPending) return;

		setError(null);

	  try {
		await deleteRating.mutateAsync(packageId);
		// Close popover
		handlePopoverClose();
	} catch (err) {
		console.error('Error deleting rating:', err);
		setError('Failed to delete rating. Please try again.');
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
						disabled={isLoading || upsertRating.isPending || deleteRating.isPending || !currentUser}
					  sx={{ p: 0.5 }}
				  >
						{(isLoading || upsertRating.isPending || deleteRating.isPending) ? (
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
					  disabled={upsertRating.isPending || deleteRating.isPending}
					  sx={{ fontSize: '1.5rem' }}
				  />

				  {userRating && (
					  <Button
						  variant="outlined"
						  color="error"
						  size="small"
						  startIcon={<DeleteIcon />}
						  onClick={handleDeleteRating}
						  disabled={upsertRating.isPending || deleteRating.isPending}
						  sx={{ mt: 1 }}
					  >
						  Remove Rating
					  </Button>
				  )}

				  {(upsertRating.isPending || deleteRating.isPending) && (
					  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						  <CircularProgress size={16} />
						  <Typography variant="caption" color="text.secondary">
							  {deleteRating.isPending ? 'Removing...' : userRating ? 'Updating...' : 'Submitting...'}
						  </Typography>
					  </Box>
				  )}
			  </Stack>
		  </Popover>
	  </Box>
  );
};

export default RatingInput;