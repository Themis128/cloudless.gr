import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import { getHeader, getCookie, createError, defineEventHandler } from 'h3'

// Get JWT secret from environment or use a default for development
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}

export interface AuthContext {
  user: User | null
  isAuthenticated: boolean
}

// Helper function to verify JWT token
export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User
    return decoded
  } catch (error) {
    return null
  }
}

// Helper function to generate JWT token
export function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Extract token from request
export function extractToken(event: H3Event): string | null {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Also check cookies
  const cookie = getCookie(event, 'auth-token')
  return cookie || null
}

// Authentication middleware
export async function requireAuth(event: H3Event, requiredRole?: 'admin' | 'user'): Promise<User> {
  const token = extractToken(event)
  
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }
  
  const user = verifyToken(token)
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired token'
    })
  }
  
  // Check role if specified
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient permissions'
    })
  }
  
  return user
}

// Optional authentication (doesn't throw, returns null if not authenticated)
export function getAuthUser(event: H3Event): User | null {
  const token = extractToken(event)
  
  if (!token) {
    return null
  }
  
  return verifyToken(token)
}

// Default export for Nitro server middleware
export default defineEventHandler(async (event) => {
  // This middleware doesn't do anything by default
  // It's just here to satisfy Nitro's requirement for a default export
  return
})

 