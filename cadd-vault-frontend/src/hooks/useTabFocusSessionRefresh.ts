import { useEffect } from 'react';
import { supabase } from '../supabase';

export const useTabFocusSessionRefresh = () => {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Tab is now visible - refresh the session
        console.log('Tab regained focus, refreshing session...');
        
        try {
          // Get the current session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting session:', error);
            return;
          }
          
          if (session) {
            // Refresh the session to ensure it's valid
            const { error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('Error refreshing session:', refreshError);
              // If refresh fails, the user might need to log in again
              // The onAuthStateChange listener should handle this
            } else {
              console.log('Session refreshed successfully');
            }
          }
        } catch (err) {
          console.error('Error in visibility change handler:', err);
        }
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle window focus events as a backup
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        handleVisibilityChange();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
};