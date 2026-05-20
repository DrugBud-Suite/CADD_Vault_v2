import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const useTabFocusSessionRefresh = () => {
  // Helper function to check if session is expired or about to expire
  const isSessionStale = (session: Session): boolean => {
    if (!session?.expires_at) return false;
    
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    // Consider session stale if it expires within 5 minutes
    return expiresAt <= fiveMinutesFromNow;
  };

  // Debounced session refresh to prevent excessive calls
  const debouncedSessionRefresh = useDebouncedCallback(
    async () => {
      if (import.meta.env.DEV) console.log('Tab regained focus, checking session...');

      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return;
        }
        
        if (session && isSessionStale(session)) {
          if (import.meta.env.DEV) console.log('Session is stale, refreshing...');
          
          // Only refresh if session is actually stale
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Error refreshing session:', refreshError);
            // If refresh fails, the user might need to log in again
            // The onAuthStateChange listener should handle this
          } else {
            if (import.meta.env.DEV) console.log('Session refreshed successfully');
          }
        } else if (session) {
          if (import.meta.env.DEV) console.log('Session is still valid, no refresh needed');
        }
      } catch (err) {
        console.error('Error in visibility change handler:', err);
      }
    },
    1000, // 1 second debounce
    { leading: false, trailing: true }
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab is now visible - check and potentially refresh session
        debouncedSessionRefresh();
      }
    };

    // Only use visibilitychange event - more reliable than focus events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      debouncedSessionRefresh.cancel(); // Cancel any pending debounced calls
    };
  }, [debouncedSessionRefresh]);
};