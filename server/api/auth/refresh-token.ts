// API endpoint to refresh JWT token
import { createError, defineEventHandler, getCookie, setCookie } from 'h3';
import type { Secret } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';

// Load environment variables
const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.NUXT_JWT_EXPIRES_IN || '7d'; // 7 days
type StringOrNumber = string | number;
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

// Define user interface for better type checking
interface UserPayload {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  role: string;
  [key: string]: any; // Allow for additional properties
}

// Function to validate JWT token
function validateToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    return null;
  }
}

// Function to generate JWT token
function generateToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET as Secret, { expiresIn: JWT_EXPIRES_IN as any });
}

// Function to check if token is close to expiration (within 15 minutes)
function isTokenNearExpiry(decoded: UserPayload): boolean {
  const tokenExp = (decoded as any).exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const timeUntilExpiry = tokenExp - currentTime;

  // Return true if token expires within 15 minutes (900000ms)
  return timeUntilExpiry < 900000;
}

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
        message: 'Unauthorized - No token provided for refresh',
      });
    }
    // Verify token
    const decoded = validateToken(token);

    if (!decoded) {
      return createError({
        statusCode: 401,
        message: 'Unauthorized - Invalid or expired token',
      });
    }

    // Only refresh if the token is near expiration or if force refresh is requested
    const forceRefresh = event.node.req.method === 'POST';
    if (!forceRefresh && !isTokenNearExpiry(decoded)) {
      return {
        success: true,
        message: 'Token is still valid',
        token: token,
        user: decoded,
        refreshed: false,
      };
    }

    // Generate new token
    const newToken = generateToken(decoded);

    // Set HTTP-only cookie with the new token
    setCookie(event, COOKIE_NAME, newToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'strict',
    });
    return {
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      user: decoded,
      refreshed: true,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return createError({
      statusCode: 500,
      message: `Internal server error during token refresh: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});
