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
