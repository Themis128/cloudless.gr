// API endpoint for verifying JWT token
import { createError, defineEventHandler, getCookie } from 'h3';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

export default defineEventHandler(async (event) => {
  try {
    // Get token from cookie or authorization header
    const cookie = getCookie(event, COOKIE_NAME);
    const authHeader = event.node.req.headers.authorization;

    const token =
      cookie || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return createError({
        statusCode: 401,
        message: 'Unauthorized - No token provided',
      });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return {
        authenticated: true,
        user: decoded,
      };
    } catch (error) {
      return createError({
        statusCode: 401,
        message: 'Unauthorized - Invalid token',
      });
    }
  } catch (error) {
    return createError({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
});
