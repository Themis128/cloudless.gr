import { H3Event } from 'h3';
import jwt from 'jsonwebtoken';

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
    return jwt.verify(token, secret);  } catch (error) {
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

/**
 * Validate email format
 * @param email The email to validate
 * @returns True if valid, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param password The password to validate
 * @returns True if valid, false otherwise
 */
export const validatePassword = (password: string): boolean => {
  // Require at least 8 characters with uppercase, lowercase, and numbers
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Helper function to get request header
const getRequestHeader = (event: H3Event, name: string): string | undefined => {
  // @ts-ignore - headers exist on event but types might not be up to date
  return event.node.req.headers[name.toLowerCase()];
};
