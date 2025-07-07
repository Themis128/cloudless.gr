import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#app'

// Manual Supabase client initialization as fallback
let supabaseClient: SupabaseClient | null = null

export function useManualSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl as string
  const supabaseAnonKey = config.public.supabaseAnonKey as string

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required')
  }

  console.log('[MANUAL SUPABASE] Creating client with URL:', supabaseUrl)
  console.log('[MANUAL SUPABASE] Anon key length:', supabaseAnonKey.length)

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: process.client ? window.localStorage : undefined,
      storageKey: 'sb-manual-auth-token',
    },
    global: {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  })

  // Add logging to auth state changes
  if (process.client) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('[MANUAL SUPABASE] Auth state changed:', event, session?.user?.email || 'no user')
    })
  }

  // Make it available globally for debugging
  if (process.client) {
    (window as unknown as Record<string, unknown>).$manualSupabase = supabaseClient
    console.log('[MANUAL SUPABASE] Client exposed to window.$manualSupabase')
  }

  return supabaseClient
}

// Enhanced Supabase client getter with fallback
export async function getEnhancedSupabaseClient(): Promise<SupabaseClient> {
  try {
    // Try the official Nuxt client first
    const { useSupabaseClient } = await import('#imports')
    const client = useSupabaseClient()
    if (client) {
      console.log('[SUPABASE] ✅ Using official @nuxtjs/supabase client')
      return client
    }
  } catch (error) {
    console.warn('[SUPABASE] ⚠️ Official client failed, falling back to manual client:', error)
  }

  // Fallback to manual client
  console.log('[SUPABASE] 🔧 Using manual Supabase client')
  return useManualSupabaseClient()
}
