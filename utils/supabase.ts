import { createClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          last_login: string | null;
        };
        Insert: {
          id: string;
          email: string;
          password_hash: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          last_login?: string | null;
        };
      };
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          status: 'pending' | 'in_progress' | 'resolved' | 'spam';
          metadata: {
            ip: string;
            userAgent: string;
            referrer: string;
            submissionTime: string;
          } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          subject?: string | null;
          message: string;
          status?: 'pending' | 'in_progress' | 'resolved' | 'spam';
          metadata?: {
            ip: string;
            userAgent: string;
            referrer: string;
            submissionTime: string;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          subject?: string | null;
          message?: string;
          status?: 'pending' | 'in_progress' | 'resolved' | 'spam';
          metadata?: {
            ip: string;
            userAgent: string;
            referrer: string;
            submissionTime: string;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          role: 'user' | 'premium' | 'moderator' | 'admin' | 'enterprise';
          subscription_plan: string | null;
          email_verified: boolean;
          permissions: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'premium' | 'moderator' | 'admin' | 'enterprise';
          subscription_plan?: string | null;
          email_verified?: boolean;
          permissions?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'premium' | 'moderator' | 'admin' | 'enterprise';
          subscription_plan?: string | null;
          email_verified?: boolean;
          permissions?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      get_storage_quota: {
        Args: Record<string, never>;
        Returns: {
          quota_bytes: number;
          used_bytes: number;
          available_bytes: number;
          percent_used: number;
        };
      };
    };
  };
}

// Create a server-side Supabase client (for API routes)
export function getSupabaseServerClient() {
  const config = useRuntimeConfig();

  if (!config.public?.supabase?.url || !config.supabase?.serviceKey) {
    throw new Error('Missing Supabase configuration. Check environment variables.');
  }

  return createClient<Database>(config.public.supabase.url, config.supabase.serviceKey);
}

// Check if Supabase is available
export function isSupabaseAvailable(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  return !!(url && key);
}

// Create a client-side Supabase client for testing
export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient<Database>(url, key);
}

// Default export for tests
const supabase = createSupabaseClient();
export default supabase;

// For composables and components, use useSupabaseClient() from @nuxtjs/supabase
// Example:
// const client = useSupabaseClient<Database>()
