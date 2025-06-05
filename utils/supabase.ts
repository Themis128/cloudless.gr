import { createClient } from '@supabase/supabase-js'

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          email: string
          password_hash: string
          last_login: string | null
        }
        Insert: {
          id: string
          email: string
          password_hash: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          last_login?: string | null
        }
      }
      contact_submissions: {
        Row: {
          id: string
          name: string
          email: string
          subject: string | null
          message: string
          status: 'pending' | 'in_progress' | 'resolved' | 'spam'
          metadata: {
            ip: string
            userAgent: string
            referrer: string
            submissionTime: string
          } | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          subject?: string | null
          message: string
          status?: 'pending' | 'in_progress' | 'resolved' | 'spam'
          metadata?: {
            ip: string
            userAgent: string
            referrer: string
            submissionTime: string
          } | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          subject?: string | null
          message?: string
          status?: 'pending' | 'in_progress' | 'resolved' | 'spam'
          metadata?: {
            ip: string
            userAgent: string
            referrer: string
            submissionTime: string
          } | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Create a server-side Supabase client (for API routes)
export function getSupabaseServerClient() {
  const config = useRuntimeConfig()
  
  if (!config.public?.supabase?.url || !config.supabaseServiceRole) {
    throw new Error('Missing Supabase configuration. Check environment variables.')
  }

  return createClient<Database>(
    config.public.supabase.url,
    config.supabaseServiceRole
  )
}

// For composables and components, use useSupabaseClient() from @nuxtjs/supabase
// Example:
// const client = useSupabaseClient<Database>()
