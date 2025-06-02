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
    const { email, password, rememberMe } = body;

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

    // Mock user authentication (replace with real database lookup)
    const validUsers = [
      {
        id: 'user-1',
        email: 'user@cloudless.gr',
        password: 'demo123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
      },
      {
        id: 'user-2',
        email: 'demo@cloudless.gr',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'user',
      },
    ];

    // Find user by email
    const user = validUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

    // Check if user exists and password is correct
    if (!user || user.password !== password) {
      // Add delay to prevent brute force attacks
      await new Promise((resolve) => setTimeout(resolve, 1000));

      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password',
      });
    }

    // Generate mock JWT token (replace with real JWT implementation)
    const token = `user_token_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate token expiry (24 hours or 30 days based on rememberMe)
    const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // ms
    const expiresAt = new Date(Date.now() + expiresIn);

    // Log successful login (in production, use proper logging)
    console.log(`[USER LOGIN] ${user.email} logged in at ${new Date().toISOString()}`);

    // Return success response
    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
      expiresAt: expiresAt.toISOString(),
      rememberMe: Boolean(rememberMe),
    };
  } catch (error: any) {
    // Log error (in production, use proper error logging)
    console.error('[USER LOGIN ERROR]:', error.message || error);

    // Return error response
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during authentication',
    });
  }
});
