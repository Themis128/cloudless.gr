// import { serverSupabaseClient } from '#supabase/server'; // Temporarily disabled
import jwt from 'jsonwebtoken';

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    });
  }

  try {
    const { email, password } = await readBody(event);

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required',
      });
    }

    // Mock authentication for development
    const ADMIN_EMAIL = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cloudless2025';

    // Simple authentication check
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      console.error('Authentication error: Invalid credentials');
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials',
      });
    }

    // Mock successful authentication
    const mockUser = {
      id: 'mock-admin-id',
      email: email,
      role: 'admin',
    };

    // Create JWT token for admin session
    const runtimeConfig = useRuntimeConfig();
    const token = jwt.sign(
      {
        userId: mockUser.id,
        email: mockUser.email,
        role: 'admin',
      },
      runtimeConfig.jwtSecret || 'default-secret',
      { expiresIn: '24h' }
    );

    // Set secure cookie
    setCookie(event, 'admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
    });

    return {
      success: true,
      user: mockUser,
    };
  } catch (error) {
    console.error('Admin login error:', error);
    throw createError({
      statusCode: (error as any).statusCode || 500,
      statusMessage: (error as any).statusMessage || 'Internal server error',
    });
  }
});
