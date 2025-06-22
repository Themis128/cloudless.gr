import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(nuxtApp => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )
  nuxtApp.provide('supabase', supabase)
})
