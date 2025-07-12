// src/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ensure environment variables are defined before creating the client
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set in .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'cadd-vault-auth',
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
  // Add timeout configuration
  realtime: {
    timeout: 30000, // 30 seconds
  }
})

/**
 * Ensure the current session is valid and refresh if needed
 * @throws Error if no valid session exists
 */
export async function ensureValidSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      throw new Error('Failed to get session');
    }
    
    if (!session) {
      throw new Error('No active session');
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt * 1000 - Date.now();
      
      // If token expires in less than 5 minutes, refresh it
      if (expiresIn < 5 * 60 * 1000) {
        console.log('Token expiring soon, refreshing...');
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Failed to refresh session:', refreshError);
          throw refreshError;
        }
        
        if (!data.session) {
          throw new Error('Failed to refresh session - no session returned');
        }
        
        return data.session;
      }
    }
    
    return session;
  } catch (error) {
    console.error('Session validation failed:', error);
    throw error;
  }
}