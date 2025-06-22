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
    // Get current failed attempts
    const { data } = await serviceSupabase
      .from('profiles')
      .select('failed_login_attempts')
      .eq('email', email)
      .single()

    const currentAttempts = data?.failed_login_attempts || 0
    const newAttempts = currentAttempts + 1    // Prepare update data
    const updateData: { failed_login_attempts: number; locked_until?: string } = {
      failed_login_attempts: newAttempts,
    }

    // Lock account after 5 failed attempts
    if (newAttempts >= 5) {
      updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
    }

    // Update the profile
    await serviceSupabase
      .from('profiles')
      .update(updateData)
      .eq('email', email)

    return {
      success: true,
      failed_attempts: newAttempts,
      is_locked: newAttempts >= 5
    }
  } catch (error) {
    console.error('Error incrementing failed login:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
