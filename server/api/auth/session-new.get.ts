// server/api/auth/session.get.ts - Unified session validation for Supabase
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { sessionCache } from '~/middleware/utils/session-cache'

interface SessionResponse {
  authenticated: boolean
  user?: {
    id: string
    email: string
    name?: string
    role: string
  }
  role?: string
  permissions?: string[]
}

export default defineEventHandler(async (event): Promise<SessionResponse> => {
  try {
    // First check for Supabase cookies
    const sbAccessToken = getCookie(event, 'sb-access-token')
    const sbRefreshToken = getCookie(event, 'sb-refresh-token')
    
    if (sbAccessToken) {
      // Check cache first for performance
      const cachedSession = sessionCache.get(sbAccessToken)
      if (cachedSession) {
        return cachedSession
      }

      try {
        // Get runtime config
        const config = useRuntimeConfig()
        const supabaseUrl = config.public.supabase.url
        const anonKey = config.public.supabase.anonKey

        if (!supabaseUrl || !anonKey) {
          console.error('Supabase configuration missing')
          return { authenticated: false }
        }

        // Create Supabase client
        const supabase = createClient(supabaseUrl, anonKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Validate session with Supabase
        const { data: sessionData, error } = await supabase.auth.setSession({
          access_token: sbAccessToken,
          refresh_token: sbRefreshToken || '',
        })

        if (error || !sessionData.session?.user) {
          // Clean up invalid cookies
          deleteCookie(event, 'sb-access-token')
          deleteCookie(event, 'sb-refresh-token')
          return { authenticated: false }
        }

        const user = sessionData.session.user
        const sessionResponse: SessionResponse = {
          authenticated: true,
          user: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0],
            role: 'user' // Default role, can be enhanced based on metadata
          },
          role: 'user',
          permissions: ['read:profile', 'update:profile']
        }

        // Cache the session for 5 minutes
        sessionCache.set(sbAccessToken, sessionResponse, 5 * 60 * 1000)

        return sessionResponse

      } catch (supabaseError) {
        console.error('Supabase session validation error:', supabaseError)
        // Clean up invalid cookies
        deleteCookie(event, 'sb-access-token')
        deleteCookie(event, 'sb-refresh-token')
        return { authenticated: false }
      }
    }

    // Fallback: Check legacy JWT tokens for admin or existing users
    const adminToken = getCookie(event, 'admin-token')
    const userToken = getCookie(event, 'auth-token')
    
    const token = adminToken || userToken
    
    if (!token) {
      return { authenticated: false }
    }

    // Check cache first for performance
    const cachedSession = sessionCache.get(token)
    if (cachedSession) {
      return cachedSession
    }

    // Verify JWT token
    const config = useRuntimeConfig()
    const JWT_SECRET = config.jwtSecret
    
    if (!JWT_SECRET) {
      throw new Error('JWT secret not configured')
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // Validate token structure
    if (!decoded || !decoded.user || !decoded.exp) {
      deleteCookie(event, adminToken ? 'admin-token' : 'auth-token')
      return { authenticated: false }
    }

    // Check if token is expired
    if (Date.now() / 1000 > decoded.exp) {
      deleteCookie(event, adminToken ? 'admin-token' : 'auth-token')
      return { authenticated: false }
    }

    const sessionData: SessionResponse = {
      authenticated: true,
      user: {
        id: decoded.user.id,
        email: decoded.user.email,
        name: decoded.user.name,
        role: decoded.user.role
      },
      role: decoded.user.role,
      permissions: decoded.user.permissions || []
    }

    // Cache the session for 5 minutes
    sessionCache.set(token, sessionData, 5 * 60 * 1000)

    return sessionData

  } catch (error) {
    console.error('Session validation error:', error)
    
    // Clean up invalid tokens
    deleteCookie(event, 'admin-token')
    deleteCookie(event, 'auth-token')
    deleteCookie(event, 'sb-access-token')
    deleteCookie(event, 'sb-refresh-token')
    
    return { authenticated: false }
  }
})
