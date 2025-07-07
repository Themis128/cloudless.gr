import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#app'

// Define basic database types
type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name?: string
          role: 'user' | 'admin' | 'moderator'
          is_active: boolean
          email_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
    }
  }
}

// Singleton client instance
let supabaseClient: SupabaseClient<Database> | null = null

/**
 * Get or create Supabase client instance
 * Follows Supabase best practices for client initialization
 */
export function useCustomSupabaseClient(): SupabaseClient<Database> {
  // Return existing client if available
  if (supabaseClient) {
    return supabaseClient
  }

  // Only initialize on client side
  if (process.server) {
    throw new Error('Supabase client should only be initialized on client side')
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl as string
  const supabaseAnonKey = config.public.supabaseAnonKey as string

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_ANON_KEY.')
  }

  // Create client with best practices configuration
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Persist session in localStorage
      persistSession: true,
      
      // Auto refresh tokens before expiry
      autoRefreshToken: true,
      
      // Detect auth state from URL (for email confirmations, etc.)
      detectSessionInUrl: true,
      
      // Use secure storage
      storage: window.localStorage,
      
      // Custom storage key to avoid conflicts
      storageKey: 'cloudless-auth-token',
      
      // Flow type for PKCE (more secure)
      flowType: 'pkce'
    },
    
    // Global configuration
    global: {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    },
    
    // Realtime configuration (if needed)
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  })

  // Set up auth state change listener
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('[SUPABASE] Auth state changed:', event, session?.user?.email || 'no user')
    
    // Handle different auth events
    switch (event) {
      case 'SIGNED_IN':
        console.log('[SUPABASE] User signed in successfully')
        break
      case 'SIGNED_OUT':
        console.log('[SUPABASE] User signed out')
        break
      case 'TOKEN_REFRESHED':
        console.log('[SUPABASE] Token refreshed')
        break
      case 'PASSWORD_RECOVERY':
        console.log('[SUPABASE] Password recovery initiated')
        break
    }
  })

  // Expose to window for debugging in development
  if (process.dev) {
    (window as unknown as Record<string, unknown>).__supabase = supabaseClient
    console.log('[SUPABASE] Client exposed to window.__supabase for debugging')
  }

  return supabaseClient
}

/**
 * Get current user session (custom implementation)
 */
export async function useCustomSupabaseSession() {
  const client = useCustomSupabaseClient()
  const { data: { session }, error } = await client.auth.getSession()
  
  if (error) {
    console.error('[SUPABASE] Error getting session:', error)
    return null
  }
  
  return session
}

/**
 * Get current authenticated user (custom implementation)
 */
export async function useCustomSupabaseUser() {
  const client = useCustomSupabaseClient()
  const { data: { user }, error } = await client.auth.getUser()
  
  if (error) {
    console.error('[SUPABASE] Error getting user:', error)
    return null
  }
  
  return user
}

/**
 * Check if user is authenticated
 */
export async function useIsAuthenticated(): Promise<boolean> {
  const session = await useCustomSupabaseSession()
  return !!session?.user
}

/**
 * Sign out user
 */
export async function useSignOut() {
  const client = useCustomSupabaseClient()
  const { error } = await client.auth.signOut()
  
  if (error) {
    console.error('[SUPABASE] Error signing out:', error)
    throw error
  }
  
  console.log('[SUPABASE] User signed out successfully')
}
