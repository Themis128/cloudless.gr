/**
 * System Admin Creation API
 * Protected endpoint for creating system administrators
 */

import type { Database } from '~/types/supabase.d'

export default defineEventHandler(async (event) => {
  try {
    // Only allow POST requests
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      })
    }

    const body = await readBody(event)
    const { email, password, fullName, username } = body

    // Validate input
    if (!email || !password || !fullName || !username) {
      throw createError({
        statusCode: 400,
        statusMessage: 'All fields are required'
      })
    }

    // Verify system credentials again for double security
    const SYSTEM_USERNAME = process.env.SYSTEM_USERNAME || 'sysadmin_cl_2025'
    if (username !== SYSTEM_USERNAME) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format'
      })
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(password)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      })
    }    // Initialize Supabase client for server-side operations
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase environment variables are not set.'
      });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient<Database>(supabaseUrl as string, supabaseServiceKey as string, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if admin already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (existingProfile) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Admin with this email already exists'
      })
    }

    // Create admin user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: fullName,
        role: 'admin'
      },
      email_confirm: true // Auto-confirm email for system-created admins
    })

    if (authError) {
      console.error('[ADMIN CREATION] Auth error:', authError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create admin user: ${authError.message}`
      })
    }

    if (!authData.user) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create admin user - no user data returned'
      })
    }

    // Update the profile to ensure admin role and active status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        is_active: true,
        email_verified: true,
        full_name: fullName as string,
        updated_at: new Date().toISOString()
      })
      .eq('id', authData.user.id as string)

    if (profileError) {
      console.error('[ADMIN CREATION] Profile update error:', profileError)
      // Try to clean up the auth user if profile update fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update admin profile: ${profileError.message}`
      })
    }

    // Log successful admin creation
    console.log(`[ADMIN CREATION] Successfully created admin: ${email} at ${new Date().toISOString()}`)

    return {
      success: true,
      message: 'Administrator created successfully',
      admin: {
        id: authData.user.id,
        email: authData.user.email,
        fullName,
        role: 'admin'
      },
      timestamp: new Date().toISOString()
    }
  } catch (error: unknown) {
    // Log failed attempts
    console.error(`[ADMIN CREATION] Failed attempt at ${new Date().toISOString()}:`, error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
