// API v1 Authentication - Register endpoint
import { defineEventHandler, readBody } from 'h3'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email, password, firstName, lastName, company } = body

    // Validate input
    if (!email || !password) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Missing required fields: email and password',
        code: 'MISSING_FIELDS'
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      }
    }

    // Validate password strength
    if (password.length < 8) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
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

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users.some(user => user.email === email)

    if (userExists) {
      event.node.res.statusCode = 409
      return {
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      }
    }

    // Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
          company: company || '',
          role: 'user'
        }
      }
    })

    if (authError) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_FAILED',
        details: authError.message
      }
    }

    if (!authData.user) {
      event.node.res.statusCode = 500
      return {
        success: false,
        error: 'User creation failed',
        code: 'USER_CREATION_FAILED'
      }
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        first_name: firstName || '',
        last_name: lastName || '',
        company: company || '',
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't fail the registration if profile creation fails
      // The profile can be created later
    }

    // Return success response
    return {
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          emailConfirmed: authData.user.email_confirmed_at ? true : false,
          createdAt: authData.user.created_at
        },
        message: authData.user.email_confirmed_at 
          ? 'Account created successfully' 
          : 'Account created successfully. Please check your email to confirm your account.'
      },
      message: 'Registration successful'
    }

  } catch (error) {
    console.error('Registration error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
}) 