import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  // Set response headers for timeout
  setHeader(event, 'Cache-Control', 'no-cache')
  
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

  try {
    // Check if user exists and is active
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('email, is_active')
      .eq('email', email)
      .single()

    if (!profile) {
      return {
        exists: false,
        error: 'No account found with this email address.'
      }
    }

    if (!profile.is_active) {
      return {
        exists: false,
        error: 'Account is deactivated. Please contact support.'
      }
    }

    return {
      exists: true,
      is_active: profile.is_active
    }
  } catch (error) {
    console.error('Error checking profile for reset:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
