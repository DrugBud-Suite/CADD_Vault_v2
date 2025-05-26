// src/services/ratingService.ts
import { supabase } from '../supabase';

export interface RatingStats {
	average_rating: number;
	ratings_count: number;
}

export interface UserRating {
	rating: number;
	rating_id: string;
}

export interface RatingUpsertResult extends RatingStats {
	user_rating: number;
	rating_id: string;
}

export class RatingService {
	/**
	 * Get current rating stats for a package
	 */
	static async getPackageRatingStats(packageId: string): Promise<RatingStats | null> {
		try {
			// Convert string packageId to UUID for the database function
			const { data, error } = await supabase
				.rpc('get_package_rating_stats', { package_uuid: packageId });

			if (error) throw error;

			if (data && data.length > 0) {
				return {
					average_rating: Number(data[0].average_rating) || 0,
					ratings_count: Number(data[0].ratings_count) || 0
				};
			}

			return { average_rating: 0, ratings_count: 0 };
		} catch (error) {
			console.error('Error fetching package rating stats:', error);
			throw error;
		}
	}

	/**
	 * Get user's current rating for a package
	 */
	static async getUserRating(packageId: string): Promise<UserRating | null> {
		try {
			// Convert string packageId to UUID for the database function
			const { data, error } = await supabase
				.rpc('get_user_rating', { package_uuid: packageId });

			if (error) throw error;

			if (data && data.length > 0) {
				return {
					rating: data[0].rating,
					rating_id: data[0].rating_id
				};
			}

			return null;
		} catch (error) {
			console.error('Error fetching user rating:', error);
			throw error;
		}
	}

	/**
	 * Submit or update a rating
	 */
	static async upsertRating(packageId: string, rating: number): Promise<RatingUpsertResult> {
		try {
			// Convert string packageId to UUID for the database function
			const { data, error } = await supabase
				.rpc('upsert_rating', {
					package_uuid: packageId,
					new_rating: rating
				});

			if (error) throw error;

			if (data && data.length > 0) {
				return {
					average_rating: Number(data[0].average_rating) || 0,
					ratings_count: Number(data[0].ratings_count) || 0,
					user_rating: data[0].user_rating,
					rating_id: data[0].rating_id
				};
			}

			throw new Error('No data returned from upsert operation');
		} catch (error) {
			console.error('Error upserting rating:', error);
			throw error;
		}
	}

	/**
	 * Delete user's rating for a package
	 */
	static async deleteRating(packageId: string): Promise<RatingStats> {
		try {
			// Convert string packageId to UUID for the database function
			const { data, error } = await supabase
				.rpc('delete_user_rating', { package_uuid: packageId });

			if (error) throw error;

			if (data && data.length > 0) {
				return {
					average_rating: Number(data[0].average_rating) || 0,
					ratings_count: Number(data[0].ratings_count) || 0
				};
			}

			return { average_rating: 0, ratings_count: 0 };
		} catch (error) {
			console.error('Error deleting rating:', error);
			throw error;
		}
	}
}

// Event types for rating updates
export interface RatingUpdateEvent {
	packageId: string;
	averageRating: number;
	ratingsCount: number;
	userRating?: number;
}

// Rating event emitter for updating UI components
export class RatingEventEmitter {
	private static listeners: Set<(event: RatingUpdateEvent) => void> = new Set();

	static subscribe(callback: (event: RatingUpdateEvent) => void) {
		this.listeners.add(callback);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(callback);
		};
	}

	static emit(event: RatingUpdateEvent) {
		this.listeners.forEach(callback => {
			try {
				callback(event);
			} catch (error) {
				console.error('Error in rating event listener:', error);
			}
		});
	}
}