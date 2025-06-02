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
    }

    // Mock token validation (replace with real JWT verification)
    // Check if token format is correct and not expired
    if (!token.startsWith('user_token_')) {
      return {
        valid: false,
        message: 'Invalid token format',
      };
    }

    // Extract timestamp from token (basic validation)
    const tokenParts = token.split('_');
    if (tokenParts.length < 4) {
      return {
        valid: false,
        message: 'Malformed token',
      };
    }

    const userId = tokenParts[2];
    const timestamp = parseInt(tokenParts[3]);

    // Check if token is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (Date.now() - timestamp > maxAge) {
      return {
        valid: false,
        message: 'Token expired',
      };
    }

    // Mock user data (replace with database lookup)
    const mockUser = {
      id: userId,
      email: 'user@cloudless.gr',
      firstName: 'John',
      lastName: 'Doe',
      role: 'user',
    };

    // Log verification (in production, use proper logging)
    console.log(`[USER VERIFY] Token verified for user ${userId} at ${new Date().toISOString()}`);

    // Return success response
    return {
      valid: true,
      message: 'Token is valid',
      user: mockUser,
    };
  } catch (error: any) {
    // Log error (in production, use proper error logging)
    console.error('[USER VERIFY ERROR]:', error.message || error);

    // Return invalid response for any error
    return {
      valid: false,
      message: 'Token verification failed',
    };
  }
});
