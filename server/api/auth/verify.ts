// API endpoint to verify authentication status
import { defineEventHandler, getCookie } from 'h3';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';

export default defineEventHandler(async (event) => {
  try {
    // Get the auth token from cookies
    const token = getCookie(event, 'auth_token');

    if (!token) {
      return {
        authenticated: false,
        user: null,
      };
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded) {
      return {
        authenticated: false,
        user: null,
      };
    }

    // Return user info
    return {
      authenticated: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        createdAt: decoded.createdAt,
      },
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      authenticated: false,
      user: null,
    };
  }
});
