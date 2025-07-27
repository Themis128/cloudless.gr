// API endpoint for handling user authentication
import crypto from 'crypto';
import { createError, defineEventHandler, readBody, setCookie } from 'h3';
import jwt, { type SignOptions } from 'jsonwebtoken';
import prisma from '../../utils/prisma';

// Load environment variables
const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.NUXT_JWT_EXPIRES_IN || '7d'; // 7 days
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

// Function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Function to validate JWT token
function validateToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Function to generate JWT token
function generateToken(user: any): string {
  const { password, ...userWithoutPassword } = user;
  const secret = JWT_SECRET as string;
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
  return jwt.sign(userWithoutPassword, secret, options);
}

// Login handler
export default defineEventHandler(async (event) => {
  // Get request method
  const method = event.node.req.method;

  // Handle login
  if (method === 'POST') {
    try {
      const body = await readBody(event);
      const { action, email, password, name } = body;

      if (!email || !password) {
        return createError({
          statusCode: 400,
          message: 'Email and password are required',
        });
      } // Login action
      if (action === 'login') {
        // Hash the incoming password to compare with stored hash
        const hashedPassword = hashPassword(password);

        // Find user in database
        const user = await prisma.user.findUnique({
          where: {
            email: email,
          },
        });

        if (!user || user.password !== hashedPassword) {
          return createError({
            statusCode: 401,
            message: 'Invalid credentials',
          });
        }

        // Update last login time
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        // Generate JWT token
        const token = generateToken(user);

        // Set HTTP-only cookie with the token
        setCookie(event, COOKIE_NAME, token, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
          sameSite: 'strict',
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        };
      }

      // Signup action
      else if (action === 'signup') {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: email },
        });

        if (existingUser) {
          return createError({
            statusCode: 409,
            message: 'Email already exists',
          });
        }

        // Validate password
        if (password.length < 6) {
          return createError({
            statusCode: 400,
            message: 'Password must be at least 6 characters',
          });
        }

        // Create new user with hashed password
        const newUser = await prisma.user.create({
          data: {
            email,
            password: hashPassword(password), // Store hashed password
            name: name || email.split('@')[0],
            role: 'user', // Default role
          },
        });

        // Generate JWT token
        const token = generateToken(newUser);

        // Set HTTP-only cookie with the token
        setCookie(event, COOKIE_NAME, token, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
          sameSite: 'strict',
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = newUser;
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        };
      }

      return createError({
        statusCode: 400,
        message: 'Invalid action',
      });
    } catch (error) {
      console.error('Auth error:', error);
      return createError({
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }

  // Method not allowed
  return createError({
    statusCode: 405,
    message: 'Method not allowed',
  });
});
