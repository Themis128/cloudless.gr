import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '~/types/supabase'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  require_admin: z.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate request body
    const body = await readBody(event)
    const { email, password, require_admin } = loginSchema.parse(body)

    const config = useRuntimeConfig()
    
    if (!config.public.supabaseUrl || !config.supabaseServiceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing'
      })
    }

    // Use service role key for admin operations
    const supabase = createClient<Database>(
      config.public.supabaseUrl,
      config.supabaseServiceKey
    )

    // First check user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, is_active, locked_until, failed_login_attempts')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      return {
        success: false,
        error: 'User not found',
        details: profileError?.message
      }
    }

    // Check if account is locked
    if (profile.locked_until) {
      const lockTime = new Date(profile.locked_until)
      if (lockTime > new Date()) {
        return {
          success: false,
          error: 'Account is locked',
          locked_until: profile.locked_until
        }
      }
    }

    // Check if account is active
    if (!profile.is_active) {
      return {
        success: false,
        error: 'Account is deactivated'
      }
    }

    // Check admin requirement
    if (require_admin && profile.role !== 'admin') {
      return {
        success: false,
        error: 'Admin access required',
        user_role: profile.role
      }
    }

    // Test authentication with regular supabase client
    const publicSupabase = createClient<Database>(
      config.public.supabaseUrl,
      config.public.supabaseAnonKey
    )

    const { data: authData, error: authError } = await publicSupabase.auth.signInWithPassword({
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

    // Sign out immediately (this is just a test)
    await publicSupabase.auth.signOut()

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
      require_admin,
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
