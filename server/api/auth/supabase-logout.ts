// server/api/auth/supabase-logout.ts - Clear both Supabase and JWT sessions
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

    // Clear JWT cookies
    deleteCookie(event, 'auth-token')
    deleteCookie(event, 'admin-token')

    // Get Supabase access token from request if available
    const body = await readBody(event).catch(() => ({}))
    const { access_token } = body

    if (access_token) {
      try {
        // Initialize Supabase client
        const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey)
          
          // Try to sign out from Supabase
          await supabase.auth.signOut()
          console.log('✅ Supabase session cleared')
        }
      } catch (supabaseError) {
        console.warn('Supabase logout error (non-critical):', supabaseError)
        // Continue with JWT cleanup even if Supabase logout fails
      }
    }

    console.log('[LOGOUT] User logged out at', new Date().toISOString())

    return {
      success: true,
      message: 'Logout successful',
    }

  } catch (error: any) {
    console.error('[LOGOUT ERROR]:', error.message || error)

    // Return error response
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during logout',
    })
  }
})
