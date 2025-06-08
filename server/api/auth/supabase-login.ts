// server/api/auth/supabase-login.ts

import { createClient } from '@supabase/supabase-js'
import { H3Event, readBody, createError, setCookie, parseCookies } from 'h3'
import { logger } from '~/utils/logger' // Requires utils/logger.ts (see below)

function verifyCsrf(event: H3Event) {
  // Skip CSRF verification in development for testing
  if (process.env.NODE_ENV === 'development') {
    return
  }

  const cookies = parseCookies(event)
  const csrfCookie = cookies['csrf-token']
  const csrfHeader = event.headers['x-csrf-token'] || event.headers['X-CSRF-Token']

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    logger.warn('❌ CSRF token mismatch')
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid CSRF token',
    })
  }
}

export default defineEventHandler(async (event: H3Event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  logger.info('🔐 Login endpoint hit')

  try {
    verifyCsrf(event)

    const body = await readBody(event)
    const { email, password } = body || {}

    if (!email || !password) {
      logger.warn('❌ Missing email or password in login')
      throw createError({ statusCode: 400, statusMessage: 'Email and password are required.' })
    }    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabase.url
    const anonKey = config.public.supabase.key // This matches nuxt.config.ts

    if (!supabaseUrl || !anonKey) {
      logger.error('❌ Supabase env vars missing')
      throw createError({ statusCode: 500, statusMessage: 'Supabase configuration missing' })
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      logger.warn({ error }, '❌ Login error for user:', email)

      let errorMessage = 'Authentication failed'
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. If you just signed up, please confirm your email.'
      } else if (error.message.toLowerCase().includes('confirm')) {
        errorMessage = 'Please confirm your email before signing in.'
      } else if (error.message.toLowerCase().includes('rate limit')) {
        errorMessage = 'Too many login attempts. Please wait and try again.'
      } else {
        errorMessage = error.message
      }

      throw createError({ statusCode: 401, statusMessage: errorMessage })
    }

    const { session, user } = data

    if (!session || !user) {
      logger.error('❌ Login succeeded but session or user object is missing')
      throw createError({ statusCode: 500, statusMessage: 'Session creation failed' })
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const
    }

    setCookie(event, 'sb-access-token', session.access_token, cookieOptions)
    setCookie(event, 'sb-refresh-token', session.refresh_token, cookieOptions)

    logger.info('✅ Login successful:', user.email)

    return {
      success: true,
      authenticated: true,
      message: 'Login successful',
      issuedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        confirmed_at: user.confirmed_at,
        user_metadata: user.user_metadata || {}
      }
    }
  } catch (err: any) {
    logger.error({ err }, '❌ Login handler failed')
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, statusMessage: 'Login error occurred' })
  }
})
