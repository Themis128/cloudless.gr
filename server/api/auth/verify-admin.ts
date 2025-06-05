import jwt from 'jsonwebtoken';

export default defineEventHandler(async (event) => {
  try {
    // Set CORS headers
    setHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });

    // Handle preflight requests
    if (getMethod(event) === 'OPTIONS') {
      return '';
    }

    // Only allow POST requests
    if (getMethod(event) !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method Not Allowed',
      });
    }

    // Get authorization header
    const authHeader = getHeader(event, 'authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return {
        valid: false,
        message: 'No token provided',
      };
    }    try {
      // Verify JWT token
      const runtimeConfig = useRuntimeConfig();
      const decoded = jwt.verify(token, (runtimeConfig.jwtSecret as string) || 'default-secret') as any;

      // Check if it's an admin token
      if (decoded.role !== 'admin') {
        return {
          valid: false,
          message: 'Invalid admin token',
        };
      }

      // Return success with user data
      return {
        valid: true,
        message: 'Token is valid',
        user: {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        },
      };
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return {
        valid: false,
        message: 'Invalid or expired token',
      };
    }
  } catch (error) {
    console.error('Admin token verification error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
