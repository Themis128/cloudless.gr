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
    const { fullName, email, password } = body;

    // Validate required fields
    if (!fullName || !email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Full name, email and password are required',
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

    // Validate password strength
    if (password.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters long',
      });
    }

    // Mock user database (replace with real database)
    const existingUsers = [
      'user@cloudless.gr',
      'demo@cloudless.gr',
      'admin@cloudless.gr',
    ];

    // Check if user already exists
    if (existingUsers.includes(email.toLowerCase())) {
      throw createError({
        statusCode: 409,
        statusMessage: 'User with this email already exists',
      });
    }

    // Generate new user ID and token
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const token = `user_token_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Split full name into first and last name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create new user object
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      firstName,
      lastName,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    // Calculate token expiry (24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Log successful signup (in production, use proper logging)
    console.log(`[USER SIGNUP] ${newUser.email} registered at ${new Date().toISOString()}`);

    // Return success response
    return {
      success: true,
      message: 'Account created successfully',
      user: newUser,
      token,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    // If it's already a createError, rethrow it
    if (typeof error === 'object' && error && 'statusCode' in error) {
      throw error;
    }
    // Log unexpected errors
    console.error('Signup error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
