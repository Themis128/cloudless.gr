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
    const { email, password, firstName, lastName } = body;

    // Validate required fields
    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required',
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

    // Mock database check for existing user
    const existingUsers = [{ email: 'user@cloudless.gr' }, { email: 'demo@cloudless.gr' }];

    if (existingUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Email already registered',
      });
    }

    // Create new user (mock implementation)
    const newUser = {
      id: `user-${Date.now()}`,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    // Generate mock JWT token
    const token = `user_token_${newUser.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Default token expiry of 24 hours
    const expiresIn = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const expiresAt = new Date(Date.now() + expiresIn);

    // Log signup (in production, use proper logging)
    console.log(
      `[USER SIGNUP] New user registered: ${newUser.email} at ${new Date().toISOString()}`
    );

    // Return success response
    return {
      success: true,
      message: 'Registration successful',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
      token,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error: any) {
    // Log error (in production, use proper error logging)
    console.error('[USER SIGNUP ERROR]:', error.message || error);

    // Return error response
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during registration',
    });
  }
});
