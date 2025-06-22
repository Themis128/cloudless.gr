import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '~/types/supabase'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate request body
    const body = await readBody(event)
    const { email, password } = loginSchema.parse(body)

    const config = useRuntimeConfig()
    
    if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing'
      })
    }

    // Use anon key for regular authentication
    const supabase = createClient<Database>(
      config.public.supabaseUrl,
      config.public.supabaseAnonKey
    )

    // Test authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return {
        success: false,
        error: 'Authentication failed',
        details: authError.message
      }
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'No user data received'
      }
    }

    // Get user profile using service key
    const serviceSupabase = createClient<Database>(
      config.public.supabaseUrl,
      config.supabaseServiceKey
    )

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', authData.user.id)
      .single()

    // Sign out immediately (this is just a test)
    await supabase.auth.signOut()

    if (profileError || !profile) {
      return {
        success: true,
        message: 'Login successful but profile not found',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: 'unknown'
        }
      }
    }

    return {
      success: true,
      message: 'Login test successful',
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        is_active: profile.is_active
      },
      auth_user_id: authData.user.id,
      admin_capable: profile.role === 'admin',
      can_login_as_user: true,
      can_login_as_admin: profile.role === 'admin'
    }

  } catch (error) {
    console.error('Login test error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request data',
        data: error.errors
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
      data: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})
