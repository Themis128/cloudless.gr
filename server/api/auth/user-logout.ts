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

    // Log logout attempt (in production, use proper logging)
    if (token) {
      console.log(
        `[USER LOGOUT] Token ${token.substring(0, 20)}... logged out at ${new Date().toISOString()}`
      );
    }

    // In a real implementation, you would:
    // 1. Validate the token
    // 2. Add it to a blacklist/revoked tokens list
    // 3. Clean up any server-side session data

    // Return success response
    return {
      success: true,
      message: 'Logout successful',
      loggedOut: true,
    };
  } catch (error: any) {
    // Log error (in production, use proper error logging)
    console.error('[USER LOGOUT ERROR]:', error.message || error);

    // Return error response
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during logout',
    });
  }
});
