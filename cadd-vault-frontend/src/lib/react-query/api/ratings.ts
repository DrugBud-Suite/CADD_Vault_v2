import { supabase } from '../../../supabase';

export interface RatingData {
  average_rating: number;
  ratings_count: number;
  user_rating?: number;
  rating_id?: string;
}

export const ratingsApi = {
  async getPackageRating(packageId: string, userId?: string): Promise<RatingData> {
    // Get rating statistics for the package
    const { data: statsData, error: statsError } = await supabase.rpc('get_package_rating_stats', {
      package_uuid: packageId,
    });

    if (statsError) throw statsError;

    let userRating = null;
    
    // Get user's rating if authenticated
    if (userId) {
      const { data: userRatingData, error: userError } = await supabase.rpc('get_user_rating', {
        package_uuid: packageId,
      });

      if (userError) throw userError;
      userRating = userRatingData?.[0];
    }

    const stats = statsData?.[0] || { average_rating: 0, ratings_count: 0 };

    return {
      average_rating: stats.average_rating || 0,
      ratings_count: stats.ratings_count || 0,
      user_rating: userRating?.rating,
      rating_id: userRating?.rating_id,
    };
  },

  async upsertRating(packageId: string, rating: number): Promise<RatingData> {
    const { data, error } = await supabase.rpc('upsert_rating', {
      package_uuid: packageId,
      new_rating: rating,
    });

    if (error) throw error;
    
    const result = data?.[0];
    if (!result) throw new Error('Failed to upsert rating');

    return {
      average_rating: result.average_rating,
      ratings_count: result.ratings_count,
      user_rating: result.user_rating,
      rating_id: result.rating_id,
    };
  },

  async deleteRating(packageId: string): Promise<RatingData> {
    const { data, error } = await supabase.rpc('delete_user_rating', {
      package_uuid: packageId,
    });

    if (error) throw error;
    
    const result = data?.[0];
    if (!result) throw new Error('Failed to delete rating');

    return {
      average_rating: result.average_rating,
      ratings_count: result.ratings_count,
      user_rating: undefined,
      rating_id: undefined,
    };
  },
};