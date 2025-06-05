import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

let supabase: SupabaseClient | null = null

export function useSupabaseClient(): SupabaseClient {
  if (supabase) return supabase
  const config = useRuntimeConfig()
  // On server, use service role if available; on client, use anon key only
  const url = config.public.supabaseUrl
  const key = process.server && config.supabaseServiceRole
    ? config.supabaseServiceRole
    : config.public.supabaseKey
  if (!url || !key) {
    throw new Error('[Supabase] Missing supabaseUrl or supabaseKey in runtimeConfig')
  }
  supabase = createClient(url, key)
  return supabase
}
