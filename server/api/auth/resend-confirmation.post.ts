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
    const { email, redirectUrl } = body

    // Validate required fields
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email is required',
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format',
      })
    }

    // Get Supabase configuration
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      throw createError({
        statusCode: 500,
        statusMessage: 'Server configuration error',
      })
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log(`📧 [RESEND API] Attempting to resend confirmation email to: ${email}`)
    console.log(`🔗 [RESEND API] Redirect URL: ${redirectUrl || 'default'}`)

    // Method 1: Try admin generateLink first (most reliable)
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
          redirectTo: redirectUrl || `${getRequestURL(event).origin}/auth/callback`
        }
      })

      if (linkError) {
        console.error(`❌ [RESEND API] Admin generateLink failed:`, linkError)
        throw linkError
      }

      console.log(`✅ [RESEND API] Admin generateLink succeeded for ${email}`)
      
      return {
        success: true,
        message: 'Confirmation email sent successfully',
        method: 'admin_generate_link',
        timestamp: new Date().toISOString()
      }
      
    } catch (adminError: any) {
      console.error(`❌ [RESEND API] Admin method failed:`, adminError.message)
      
      // Method 2: Fallback to standard client methods
      const anonKey = process.env.SUPABASE_ANON_KEY
      if (!anonKey) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Missing anonymous key for fallback method',
        })
      }

      const clientSupabase = createClient(supabaseUrl, anonKey)
      
      console.log(`🔄 [RESEND API] Trying client resend method as fallback`)
      
      const { data: resendData, error: resendError } = await clientSupabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl || `${getRequestURL(event).origin}/auth/callback`
        }
      })

      if (resendError) {
        console.error(`❌ [RESEND API] Client resend also failed:`, resendError)
        
        // Check for specific error types
        if (resendError.message.includes('User already registered') || 
            resendError.message.includes('already confirmed')) {
          return {
            success: true,
            message: 'Email is already confirmed. You can sign in normally.',
            method: 'already_confirmed',
            timestamp: new Date().toISOString()
          }
        } else if (resendError.message.includes('rate limit')) {
          throw createError({
            statusCode: 429,
            statusMessage: 'Too many requests. Please wait before trying again.',
          })
        } else if (resendError.message.includes('User not found')) {
          throw createError({
            statusCode: 404,
            statusMessage: 'No account found with this email address.',
          })
        } else {
          throw createError({
            statusCode: 500,
            statusMessage: `Email service error: ${resendError.message}`,
          })
        }
      }

      console.log(`✅ [RESEND API] Client resend succeeded for ${email}`)
      
      return {
        success: true,
        message: 'Confirmation email sent successfully',
        method: 'client_resend',
        timestamp: new Date().toISOString()
      }
    }

  } catch (error: any) {
    console.error('❌ [RESEND API] Server error:', error)
    
    // Handle different error types
    if (error.statusCode) {
      // Already a proper HTTP error
      throw error
    } else if (error.message?.includes('timeout')) {
      throw createError({
        statusCode: 504,
        statusMessage: 'Email service timeout. Please try again.',
      })
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Email service unavailable. Please try again later.',
      })
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to send confirmation email. Please try again.',
      })
    }
  }
})
