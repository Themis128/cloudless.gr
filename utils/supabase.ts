import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_KEY environment variable. Supabase client will not be available.');
} else {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}

export function isSupabaseAvailable(): boolean {
  return !!supabase;
}

export { supabase };
export default supabase;
