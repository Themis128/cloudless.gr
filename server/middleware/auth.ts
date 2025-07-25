<<<<<<< HEAD
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

 
=======
import { createError, defineEventHandler, getCookie, getHeader } from 'h3';
import jwt from 'jsonwebtoken';

/**
 * Production-ready middleware to authenticate API requests using JWT tokens
 */
export default defineEventHandler((event) => {
  // JWT configuration - use environment variables in production
  const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
  const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

  // Get the current path
  const path = event.node.req.url || '';

  // Routes that don't require authentication
  const publicRoutes = ['/api/auth/user', '/api/auth/verify', '/api/auth/logout'];

  // Skip auth check for non-API routes or public API routes
  if (!path.startsWith('/api/') || publicRoutes.some((route) => path.startsWith(route))) {
    return;
  }

  // Admin-only routes require the 'admin' role
  const adminRoutes = ['/api/contact-submissions', '/api/admin'];
  const requiresAdmin = adminRoutes.some((route) => path.startsWith(route));

  // Get token from cookie or authorization header
  const cookie = getCookie(event, COOKIE_NAME);
  const authHeader = getHeader(event, 'Authorization');

  const token =
    cookie || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

  // No token, no access
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required to access this resource',
    });
  }

  // Verify the token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Type guard to check if decoded is an object with role property
    if (
      typeof decoded !== 'string' &&
      decoded &&
      typeof decoded === 'object' &&
      'role' in decoded
    ) {
      // Add user info to event context for use in API handlers
      event.context.auth = decoded;

      // Check if admin access is required but user is not an admin
      if (requiresAdmin && decoded.role !== 'admin') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden',
          message: 'Admin access required',
        });
      }
    } else {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid token format',
      });
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid or expired authentication token',
    });
  }
});
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
