/**
 * Tests for ratingsApi — getPackageRating, upsertRating, deleteRating.
 *
 * All Supabase RPC calls are mocked. Error paths verify that thrown errors
 * propagate unchanged to the caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratingsApi } from '../../../../src/lib/react-query/api/ratings';
import { supabase } from '../../../../src/supabase';

vi.mock('../../../../src/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// getPackageRating
// ---------------------------------------------------------------------------

describe('ratingsApi.getPackageRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls get_package_rating_stats with package_uuid', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 4.2, ratings_count: 10 }],
      error: null,
    } as any);

    await ratingsApi.getPackageRating('pkg-1');

    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('get_package_rating_stats', {
      package_uuid: 'pkg-1',
    });
  });

  it('returns correct average_rating and ratings_count', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 4.2, ratings_count: 10 }],
      error: null,
    } as any);

    const result = await ratingsApi.getPackageRating('pkg-1');

    expect(result.average_rating).toBe(4.2);
    expect(result.ratings_count).toBe(10);
  });

  it('returns zero defaults when stats data is empty', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [], error: null } as any);

    const result = await ratingsApi.getPackageRating('pkg-1');

    expect(result.average_rating).toBe(0);
    expect(result.ratings_count).toBe(0);
  });

  it('does not call get_user_rating when userId is not provided', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 3.0, ratings_count: 5 }],
      error: null,
    } as any);

    await ratingsApi.getPackageRating('pkg-1');

    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledTimes(1);
  });

  it('user_rating is undefined when userId is not provided', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 3.0, ratings_count: 5 }],
      error: null,
    } as any);

    const result = await ratingsApi.getPackageRating('pkg-1');

    expect(result.user_rating).toBeUndefined();
  });

  it('fetches user rating when userId is provided', async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [{ average_rating: 3.5, ratings_count: 5 }],
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: [{ rating: 4, rating_id: 'rating-1' }],
        error: null,
      } as any);

    const result = await ratingsApi.getPackageRating('pkg-1', 'user-1');

    expect(result.user_rating).toBe(4);
    expect(result.rating_id).toBe('rating-1');
    expect(vi.mocked(supabase.rpc)).toHaveBeenNthCalledWith(2, 'get_user_rating', {
      package_uuid: 'pkg-1',
    });
  });

  it('throws when stats RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    } as any);

    await expect(ratingsApi.getPackageRating('pkg-1')).rejects.toMatchObject({
      message: 'Database error',
    });
  });

  it('throws when user rating RPC returns an error', async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [{ average_rating: 4, ratings_count: 5 }],
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'User rating error' },
      } as any);

    await expect(ratingsApi.getPackageRating('pkg-1', 'user-1')).rejects.toMatchObject({
      message: 'User rating error',
    });
  });
});

// ---------------------------------------------------------------------------
// upsertRating
// ---------------------------------------------------------------------------

describe('ratingsApi.upsertRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls upsert_rating RPC with correct params', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 4.5, ratings_count: 12, user_rating: 5, rating_id: 'rating-2' }],
      error: null,
    } as any);

    await ratingsApi.upsertRating('pkg-1', 5);

    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('upsert_rating', {
      package_uuid: 'pkg-1',
      new_rating: 5,
    });
  });

  it('returns normalized RatingData on success', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 4.5, ratings_count: 12, user_rating: 5, rating_id: 'rating-2' }],
      error: null,
    } as any);

    const result = await ratingsApi.upsertRating('pkg-1', 5);

    expect(result.average_rating).toBe(4.5);
    expect(result.ratings_count).toBe(12);
    expect(result.user_rating).toBe(5);
    expect(result.rating_id).toBe('rating-2');
  });

  it('throws when RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Constraint violation' },
    } as any);

    await expect(ratingsApi.upsertRating('pkg-1', 3)).rejects.toMatchObject({
      message: 'Constraint violation',
    });
  });

  it('throws when data array is empty', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [], error: null } as any);

    await expect(ratingsApi.upsertRating('pkg-1', 3)).rejects.toThrow('Failed to upsert rating');
  });
});

// ---------------------------------------------------------------------------
// deleteRating
// ---------------------------------------------------------------------------

describe('ratingsApi.deleteRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls delete_user_rating RPC with correct package ID', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 3.0, ratings_count: 8 }],
      error: null,
    } as any);

    await ratingsApi.deleteRating('pkg-1');

    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('delete_user_rating', {
      package_uuid: 'pkg-1',
    });
  });

  it('returns RatingData with user_rating and rating_id undefined', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ average_rating: 3.0, ratings_count: 8 }],
      error: null,
    } as any);

    const result = await ratingsApi.deleteRating('pkg-1');

    expect(result.average_rating).toBe(3.0);
    expect(result.ratings_count).toBe(8);
    expect(result.user_rating).toBeUndefined();
    expect(result.rating_id).toBeUndefined();
  });

  it('throws when RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Delete failed' },
    } as any);

    await expect(ratingsApi.deleteRating('pkg-1')).rejects.toMatchObject({
      message: 'Delete failed',
    });
  });

  it('throws when data array is empty', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [], error: null } as any);

    await expect(ratingsApi.deleteRating('pkg-1')).rejects.toThrow('Failed to delete rating');
  });
});
