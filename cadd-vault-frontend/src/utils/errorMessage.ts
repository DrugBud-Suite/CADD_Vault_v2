/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * Handles native Error instances and the plain `{ message }` objects that
 * Supabase / PostgREST reject with — those are NOT Error instances, so a bare
 * `err instanceof Error` check silently drops their message.
 */
export function getErrorMessage(
  err: unknown,
  fallback = 'An unexpected error occurred',
): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string' && err) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const { message } = err as { message: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
