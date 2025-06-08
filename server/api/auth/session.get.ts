// server/api/auth/session.get.ts

import { createClient } from '@supabase/supabase-js'
import { getCookie, H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabase.url
  const anonKey = config.public.supabase.key // This matches nuxt.config.ts

  if (!supabaseUrl || !anonKey) {
    return {
      authenticated: false,
      error: 'Supabase configuration missing',
    }
  }

  // Read cookies from the request
  const accessToken = getCookie(event, 'sb-access-token')
  const refreshToken = getCookie(event, 'sb-refresh-token')

  if (!accessToken || !refreshToken) {
    return {
      authenticated: false,
      error: 'Missing auth cookies',
    }
  }

  // Create a temporary Supabase client with the token
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  })

  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    return {
      authenticated: false,
      error: error?.message || 'Session invalid or expired',
    }
  }

  return {
    authenticated: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: 'user', // Default role, can be enhanced based on user metadata
    },
    role: 'user',
    permissions: ['read:profile', 'update:profile'],
    sessionCheckedAt: new Date().toISOString(),
  }
})
