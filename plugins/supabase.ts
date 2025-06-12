import { createClient } from '@supabase/supabase-js'
import { defineNuxtPlugin, useRuntimeConfig } from '#app'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const supabase = createClient(
    config.public.SUPABASE_URL,
    config.public.SUPABASE_ANON_KEY
  )

  return {
    provide: {
      supabase,
    },
  }
})
