import { H3Event } from 'h3';
import jwt from 'jsonwebtoken';

/**
 * Server-side authentication utilities
 * These functions use Node.js libraries and should only run on the server
 */

/**
 * Generate a JWT token for the given user ID and email
 * @param userId The user's ID
 * @param email The user's email
 * @returns The generated JWT token
 */
export const generateToken = (userId: string, email: string): string => {
  const secret = process.env.NUXT_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret not configured');
  }

  return jwt.sign(
    {
      userId,
      email,
    },
    secret,
    {
      expiresIn: '7d', // Token expires in 7 days
    }
  );
};

/**
 * Verify a JWT token
 * @param token The token to verify
 * @returns The decoded token payload or null if invalid
 */
export const verifyToken = (token: string): any => {
  const secret = process.env.NUXT_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret not configured');
  }

  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
};

/**
 * Get the authenticated user from the request
 * @param event The H3 event
 * @returns The authenticated user or null
 */
export const getAuthUser = (event: H3Event): any | null => {
  const authHeader = getRequestHeader(event, 'Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyToken(token);
};

/**
 * Check if a request is authenticated
 * @param event The H3 event
 * @returns True if authenticated, false otherwise
 */
export const isAuthenticated = (event: H3Event): boolean => {
  return getAuthUser(event) !== null;
};

// Helper function to get request header
const getRequestHeader = (event: H3Event, name: string): string | undefined => {
  // @ts-ignore - headers exist on event but types might not be up to date
  return event.node.req.headers[name.toLowerCase()];
};
