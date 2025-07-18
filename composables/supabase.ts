

import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from 'nuxt/app'
import type { Database } from '~/types/database.types'

let supabase: ReturnType<typeof createClient<Database>> | null = null

export function useSupabase() {
  if (!supabase) {
    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabaseUrl as string
    const supabaseKey = config.public.supabaseKey as string
    
    // Check if we have the required environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase environment variables not found:', {
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey
      })
      
      // Return a mock client that will throw clear errors
      return {
        from: () => ({
          select: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
        }),
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          signIn: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          signOut: () => Promise.resolve({ error: null })
        }
      } as any
    }
    
    supabase = createClient<Database>(supabaseUrl, supabaseKey)
  }
  return supabase
}
