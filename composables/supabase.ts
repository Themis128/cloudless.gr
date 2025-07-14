
import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from 'nuxt/app'
import type { Database } from '~/types/database.types'

export function useSupabase() {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl as string
  const supabaseKey = config.public.supabaseKey as string
  return createClient<Database>(supabaseUrl, supabaseKey)
}
