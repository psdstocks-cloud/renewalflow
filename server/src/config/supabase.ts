import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const supabaseUrl = 'https://kklvoalugoviguvmxbxw.supabase.co';
// Use service role key for server-side operations (bypasses RLS)
// Use anon key for client-side operations
const supabaseKey = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.warn('Warning: SUPABASE_KEY or SUPABASE_ANON_KEY not set in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Export anon client for client-side use if needed
export const supabaseAnon = env.SUPABASE_ANON_KEY 
  ? createClient(supabaseUrl, env.SUPABASE_ANON_KEY)
  : null;

