/**
 * Tests for withSessionRetry — retries a Supabase operation once after a
 * session refresh when the failure looks auth-related.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const refreshSession = vi.hoisted(() => vi.fn());

vi.mock('../../src/supabase', () => ({
  supabase: { auth: { refreshSession } },
}));

import { withSessionRetry } from '../../src/lib/supabaseRetry';

beforeEach(() => {
  refreshSession.mockReset();
});

describe('withSessionRetry', () => {
  it('returns the result without retrying when the operation succeeds', async () => {
    const op = vi.fn().mockResolvedValue({ data: 'ok', error: null });
    const result = await withSessionRetry(op);

    expect(result).toEqual({ data: 'ok', error: null });
    expect(op).toHaveBeenCalledOnce();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('does not refresh the session for a non-auth error', async () => {
    const op = vi.fn().mockResolvedValue({ data: null, error: { message: 'duplicate key' } });
    const result = await withSessionRetry(op);

    expect(result.error?.message).toBe('duplicate key');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes the session and retries on an auth error', async () => {
    const op = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'JWT expired' } })
      .mockResolvedValueOnce({ data: 'ok', error: null });
    refreshSession.mockResolvedValue({ error: null });

    const result = await withSessionRetry(op);

    expect(refreshSession).toHaveBeenCalledOnce();
    expect(op).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'ok', error: null });
  });

  it('captures a thrown exception as an error result', async () => {
    const op = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await withSessionRetry(op, { maxRetries: 0 });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('network down');
  });
});
