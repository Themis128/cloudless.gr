import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  // Set response headers for timeout
  setHeader(event, 'Cache-Control', 'no-cache')
  
  try {
    const body = await readBody(event)
    const { email } = body

    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email is required'
      })
    }

    const config = useRuntimeConfig()
    
    // Create service role client (only available on server)
    const serviceSupabase = createClient(
      config.public.supabaseUrl,
      config.supabaseServiceKey
    )

    // Check if profile exists and get user info
    const { data: profileCheck, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('locked_until, failed_login_attempts, role, is_active')
      .eq('email', email)
      .single()

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return {
          exists: false,
          error: 'No account found with this email address.'
        }
      } else if (profileError.code === 'PGRST119') {
        return {
          exists: false,
          error: 'Multiple accounts found with this email. Please contact support.'
        }
      } else {
        throw createError({
          statusCode: 500,
          statusMessage: `Database error: ${profileError.message}`
        })
      }
    }

    return {
      exists: true,
      profile: profileCheck
    }
  } catch (error) {
    console.error('Error checking profile:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
