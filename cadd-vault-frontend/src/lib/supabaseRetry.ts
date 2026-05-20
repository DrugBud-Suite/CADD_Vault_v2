import { supabase } from '../supabase';
import { getErrorMessage } from '../utils/errorMessage';

/** Minimal shape of a Supabase/PostgREST error used for retry decisions. */
export interface SupabaseOperationError {
  message?: string;
  code?: string;
  details?: string;
}

export interface SupabaseOperationResult<T> {
  data: T | null;
  error: SupabaseOperationError | null;
}

const isAuthError = (error: SupabaseOperationError): boolean =>
  Boolean(
    error.message?.includes('JWT') ||
    error.message?.includes('token') ||
    error.code === 'PGRST301' ||
    error.code === '401',
  );

/**
 * Run a Supabase operation, retrying once after refreshing the session when
 * the failure looks auth-related (expired JWT). Shared by admin/edit pages
 * that issue direct Supabase calls outside the React Query API layer.
 */
export async function withSessionRetry<T>(
  operation: () => PromiseLike<SupabaseOperationResult<T>>,
  options: { maxRetries?: number; onRetry?: () => void } = {},
): Promise<SupabaseOperationResult<T>> {
  const { maxRetries = 1, onRetry } = options;
  let lastError: SupabaseOperationError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      if (result.error && isAuthError(result.error) && attempt < maxRetries) {
        onRetry?.();
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          lastError = { message: refreshError.message };
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      return result;
    } catch (error) {
      lastError = { message: getErrorMessage(error) };
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  return { data: null, error: lastError };
}
