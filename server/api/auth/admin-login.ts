import { H3Event, setCookie } from 'h3';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRY = '24h'; // 24 hours

export default defineEventHandler(async (event: H3Event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    });
  }

  try {
    const body = await readBody(event);
    const email = body.email?.toLowerCase();
    const password = body.password;

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required',
      });
    }

    // Get admin credentials from environment
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@cloudless.gr').toLowerCase();
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cloudless2025';

    console.log('Admin login attempt:', { email, expectedEmail: ADMIN_EMAIL });

    // Authentication check
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      console.error('Authentication failed: Invalid credentials');
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials',
      });
    }    // Create user payload
    const payload = {
      id: 'dev-admin',
      email: email,
      role: 'admin'
    };

    console.log('Creating JWT with payload:', payload);
    console.log('JWT_SECRET length:', JWT_SECRET.length);

    // Generate JWT token
    let token;
    try {
      token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      console.log('JWT token generated successfully, length:', token.length);
    } catch (jwtError) {
      console.error('JWT generation error:', jwtError);
      throw createError({
        statusCode: 500,
        statusMessage: 'Token generation failed',
      });
    }
    
    // Calculate expiration timestamp (24 hours from now)
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // Unix timestamp

    console.log('Token generated successfully:', { 
      tokenLength: token.length, 
      expiresAt,
      expiresAtDate: new Date(expiresAt * 1000).toISOString()
    });

    // Set secure cookie
    setCookie(event, 'admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 // 24 hours in seconds
    });

    const response = {
      success: true,
      message: 'Admin login successful',
      user: payload,
      token: token,
      expiresAt: expiresAt
    };

    console.log('Admin login response:', response);
    return response;

  } catch (error) {
    console.error('Admin login error:', error);
    throw createError({
      statusCode: (error as any).statusCode || 500,
      statusMessage: (error as any).statusMessage || 'Internal server error',
    });
  }
});
