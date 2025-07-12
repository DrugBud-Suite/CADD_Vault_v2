import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { queryKeys } from '../../lib/react-query/queryKeys';
import { ratingsApi, RatingData } from '../../lib/react-query/api/ratings';
import { useAuth } from '../../context/AuthContext';

export function usePackageRating(packageId: string) {
  const { currentUser } = useAuth();

  return useQuery({
    queryKey: queryKeys.ratings.user(packageId, currentUser?.id || 'anonymous'),
    queryFn: () => ratingsApi.getPackageRating(packageId, currentUser?.id),
    enabled: !!packageId,
    staleTime: 1000 * 60 * 2, // 2 minutes - ratings can change frequently
  });
}

export function useUpsertRating() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: ({ packageId, rating }: { packageId: string; rating: number }) =>
      ratingsApi.upsertRating(packageId, rating),
    onMutate: async ({ packageId, rating }) => {
      if (!currentUser) return;

      // Cancel outgoing queries for this rating
      await queryClient.cancelQueries({
        queryKey: queryKeys.ratings.user(packageId, currentUser.id),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<RatingData>(
        queryKeys.ratings.user(packageId, currentUser.id)
      );

      // Optimistically update the rating
      if (previousData) {
        const isNewRating = !previousData.user_rating;
        const oldRating = previousData.user_rating || 0;
        const newCount = isNewRating 
          ? previousData.ratings_count + 1 
          : previousData.ratings_count;

        // Calculate new average
        let newAverage;
        if (isNewRating) {
          newAverage = (previousData.average_rating * previousData.ratings_count + rating) / newCount;
        } else {
          newAverage = (previousData.average_rating * previousData.ratings_count - oldRating + rating) / newCount;
        }

        queryClient.setQueryData(
          queryKeys.ratings.user(packageId, currentUser.id),
          {
            ...previousData,
            average_rating: Math.round(newAverage * 10) / 10,
            ratings_count: newCount,
            user_rating: rating,
          }
        );
      }

      return { previousData };
    },
    onError: (_err, { packageId }, context) => {
      if (!currentUser) return;

      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.ratings.user(packageId, currentUser.id),
          context.previousData
        );
      }
      toast.error('Failed to update rating');
    },
    onSuccess: (data, { packageId }) => {
      if (!currentUser) return;

      // Update the cache with the actual server response
      queryClient.setQueryData(
        queryKeys.ratings.user(packageId, currentUser.id),
        data
      );

      // Invalidate package data to update average rating
      queryClient.invalidateQueries({
        queryKey: queryKeys.packages.detail(packageId),
      });

      // Invalidate package lists to update ratings there too
      queryClient.invalidateQueries({
        queryKey: queryKeys.packages.lists(),
      });

      toast.success('Rating updated successfully');
    },
  });
}

export function useDeleteRating() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: (packageId: string) => ratingsApi.deleteRating(packageId),
    onMutate: async (packageId) => {
      if (!currentUser) return;

      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.ratings.user(packageId, currentUser.id),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<RatingData>(
        queryKeys.ratings.user(packageId, currentUser.id)
      );

      // Optimistically remove the user rating
      if (previousData && previousData.user_rating) {
        const newCount = Math.max(0, previousData.ratings_count - 1);
        const newAverage = newCount > 0 
          ? (previousData.average_rating * previousData.ratings_count - previousData.user_rating) / newCount
          : 0;

        queryClient.setQueryData(
          queryKeys.ratings.user(packageId, currentUser.id),
          {
            ...previousData,
            average_rating: Math.round(newAverage * 10) / 10,
            ratings_count: newCount,
            user_rating: undefined,
            rating_id: undefined,
          }
        );
      }

      return { previousData };
    },
    onError: (_err, packageId, context) => {
      if (!currentUser) return;

      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.ratings.user(packageId, currentUser.id),
          context.previousData
        );
      }
      toast.error('Failed to remove rating');
    },
    onSuccess: (data, packageId) => {
      if (!currentUser) return;

      // Update cache with server response
      queryClient.setQueryData(
        queryKeys.ratings.user(packageId, currentUser.id),
        data
      );

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.packages.detail(packageId),
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.packages.lists(),
      });

      toast.success('Rating removed successfully');
    },
  });
}