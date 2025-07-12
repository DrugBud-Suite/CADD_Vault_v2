// src/utils/supabaseRetry.ts
import { supabase } from '../supabase';

interface RetryOptions {
  maxRetries?: number;
  onRetry?: () => void;
}

/**
 * Wrapper to retry Supabase operations with session refresh
 */
export async function withSessionRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  const { maxRetries = 1, onRetry } = options;
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Check if the error is auth-related
      if (result.error && 
          (result.error.message?.includes('JWT') || 
           result.error.message?.includes('token') ||
           result.error.code === 'PGRST301' || // JWT expired
           result.error.code === '401')) {
        
        if (attempt < maxRetries) {
          console.log('Auth error detected, refreshing session...');
          onRetry?.();
          
          // Try to refresh the session
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Failed to refresh session:', refreshError);
            lastError = refreshError;
            continue;
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
      }
      
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(`Operation failed, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  return { data: null, error: lastError };
}

// Example usage in your component:
/*
const handleUpdateSuggestionStatus = async (suggestionId: string, newStatus: string) => {
  const { data, error } = await withSessionRetry(
    () => supabase
      .from('package_suggestions')
      .update({ status: newStatus })
      .eq('id', suggestionId),
    { 
      maxRetries: 1,
      onRetry: () => setError('Session expired, refreshing...')
    }
  );
  
  if (error) {
    setError(`Failed to update: ${error.message}`);
  } else {
    // Success handling
  }
};
*/