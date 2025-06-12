import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#app'

const config = useRuntimeConfig()
const supabase = createClient(
  String(config.public.SUPABASE_URL),
  String(config.public.SUPABASE_ANON_KEY)
)

export { supabase }
