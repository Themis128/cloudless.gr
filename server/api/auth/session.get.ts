// server/api/auth/session.get.ts - Unified session validation endpoint
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
    // Check both admin and user tokens
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
    const JWT_SECRET = process.env.NUXT_JWT_SECRET
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
    
    return { authenticated: false }
  }
})
