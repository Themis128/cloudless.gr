// Server middleware to verify JWT tokens for admin routes
import { getCookie } from 'h3';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

export default defineEventHandler(async (event) => {
  // Only apply to admin API routes
  if (!event.node.req.url?.startsWith('/api/admin')) {
    return;
  }

  // Skip auth for login endpoint
  if (event.node.req.url === '/api/auth/admin-login') {
    return;
  }

  try {
    // Get token from cookie
    const token = getCookie(event, COOKIE_NAME);

    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user has admin role
    if (!decoded || (decoded as any).role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin privileges required',
      });
    }

    // Add user info to event context for use in API handlers
    event.context.user = decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token',
      });
    }
    throw error;
  }
});
