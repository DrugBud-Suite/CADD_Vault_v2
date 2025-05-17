// src/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ensure environment variables are defined before creating the client
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set in .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)