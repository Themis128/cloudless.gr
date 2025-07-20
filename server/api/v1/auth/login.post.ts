// API v1 Authentication - Login endpoint
import { defineEventHandler, readBody } from 'h3'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Missing required fields: email and password',
        code: 'MISSING_FIELDS'
      }
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      event.node.res.statusCode = 500
      return {
        success: false,
        error: 'Authentication service not configured',
        code: 'SERVICE_UNAVAILABLE'
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      event.node.res.statusCode = 401
      return {
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        details: authError.message
      }
    }

    if (!authData.user) {
      event.node.res.statusCode = 401
      return {
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      }
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
    const token = jwt.sign(
      {
        userId: authData.user.id,
        email: authData.user.email,
        role: authData.user.role || 'user'
      },
      jwtSecret,
      { expiresIn: '24h' }
    )

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    // Return success response
    return {
      success: true,
      data: {
        token,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          emailConfirmed: authData.user.email_confirmed_at ? true : false,
          createdAt: authData.user.created_at,
          lastSignIn: authData.user.last_sign_in_at,
          profile: profile || null
        },
        expiresIn: '24h',
        tokenType: 'Bearer'
      },
      message: 'Login successful'
    }

  } catch (error) {
    console.error('Login error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
}) 