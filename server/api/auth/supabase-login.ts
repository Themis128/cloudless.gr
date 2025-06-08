// server/api/auth/supabase-login.ts - Bridge Supabase auth to JWT tokens
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    // Set CORS headers
    setHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })

    // Handle preflight requests
    if (getMethod(event) === 'OPTIONS') {
      return ''
    }

    // Only allow POST requests
    if (getMethod(event) !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method Not Allowed',
      })
    }

    // Parse request body
    const body = await readBody(event)
    const { access_token, refresh_token } = body

    if (!access_token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Access token is required',
      })
    }    // Get configuration from runtime config
    const config = useRuntimeConfig()
    const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET
    const JWT_EXPIRES_IN = '7d'

    if (!JWT_SECRET) {
      throw createError({
        statusCode: 500,
        statusMessage: 'JWT secret not configured',
      })
    }

    // Initialize Supabase client using runtime config
    const supabaseUrl = config.public.supabase.url
    const supabaseKey = config.public.supabase.key

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey })
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing',
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Set the session in Supabase to get user info
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token || '',
    })

    if (sessionError || !sessionData.session?.user) {
      console.error('Supabase session error:', sessionError)
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid Supabase session',
      })
    }

    const supabaseUser = sessionData.session.user

    // Create JWT payload
    const userPayload = {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
      role: 'user', // Default role, can be enhanced based on metadata
      permissions: ['read:profile', 'update:profile'],
      provider: 'supabase',
      supabase_id: supabaseUser.id,
    }    // Generate JWT token
    const jwtToken = jwt.sign(userPayload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRES_IN
    })

    // Set HTTP-only cookie
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
    
    setCookie(event, 'auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    console.log(`[SUPABASE LOGIN] ${userPayload.email} logged in at ${new Date().toISOString()}`)

    // Return success response
    return {
      success: true,
      message: 'Login successful',
      user: {
        id: userPayload.id,
        email: userPayload.email,
        name: userPayload.name,
        role: userPayload.role,
      },
      token: jwtToken,
      expiresAt: expiresAt.toISOString(),
    }

  } catch (error: any) {
    console.error('[SUPABASE LOGIN ERROR]:', error.message || error)

    // Return error response
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during authentication',
    })
  }
})