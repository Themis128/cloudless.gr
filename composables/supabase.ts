

import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from 'nuxt/app'
import type { Database } from '~/types/database.types'

let supabase: ReturnType<typeof createClient<Database>> | null = null

export function useSupabase() {
  if (!supabase) {
    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabaseUrl as string
    const supabaseKey = config.public.supabaseKey as string
    supabase = createClient<Database>(supabaseUrl, supabaseKey)
  }
  return supabase
}
