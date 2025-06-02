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

    // Parse request body
    const body = await readBody(event);
    const { email } = body;

    // Validate required fields
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format',
      });
    }

    // Mock valid users database
    const validUsers = [{ email: 'user@cloudless.gr' }, { email: 'demo@cloudless.gr' }];

    // Check if user exists
    const user = validUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

    // Always return success to prevent email enumeration
    // In a real implementation, only send the email if the user exists
    if (user) {
      // Mock email sending
      // In production, integrate with your email service
      console.log(`[PASSWORD RESET] Reset link would be sent to: ${email}`);

      // Generate a reset token valid for 1 hour
      const _resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresIn = 60 * 60 * 1000; // 1 hour in milliseconds
      const _expiresAt = new Date(Date.now() + expiresIn);

      // Store the reset token (in production, save to database)
      // resetTokens.set(resetToken, { email, expiresAt });
    }

    // Return success response
    return {
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.',
    };
  } catch (error: any) {
    // Log error (in production, use proper error logging)
    console.error('[PASSWORD RESET ERROR]:', error.message || error);

    // Return error response
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error processing password reset request',
    });
  }
});
