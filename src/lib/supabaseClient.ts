import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables:
  - VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}
  - VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}
  
  Please configure these in Cloudflare Pages → Settings → Environment Variables`;
  console.error(errorMsg);
  
  // Create a dummy client to prevent crashes, but log the error
  if (typeof window !== 'undefined') {
    console.error('Supabase client cannot be initialized without environment variables');
  }
}

// Only create client if both values are present
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Supabase configuration error: Missing required environment variables.
    VITE_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Missing'}
    VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Missing'}
    
    Please add these to Cloudflare Pages environment variables and redeploy.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
