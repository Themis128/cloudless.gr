// API endpoint for handling user authentication
import crypto from 'crypto';
import { createError, defineEventHandler, readBody, setCookie } from 'h3';
import jwt from 'jsonwebtoken';

// Load environment variables
const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.NUXT_JWT_EXPIRES_IN || '7d'; // 7 days
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

// Function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Function to generate JWT token
function generateToken(user: any): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user;
  return jwt.sign(userWithoutPassword, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

// Simple in-memory storage for demo purposes
// In a real app, you would use a database
const users = [
  {
    id: '1',
    email: 'demo@example.com',
    password: hashPassword('password'), // Store hashed password
    name: 'Demo User',
    createdAt: '2025-05-23T12:00:00Z',
    role: 'user',
  },
  {
    id: '2',
    email: 'test@example.com',
    password: hashPassword('Password123!'), // Store hashed password
    name: 'Test User',
    createdAt: '2025-05-24T10:30:00Z',
    role: 'user',
  },
];

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
        const user = users.find((u) => u.email === email && u.password === hashedPassword);

        if (!user) {
          return createError({
            statusCode: 401,
            message: 'Invalid credentials',
          });
        }

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = user;
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        };
      }

      // Signup action
      else if (action === 'signup') {
        // Check if user already exists
        if (users.find((u) => u.email === email)) {
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
        const newUser = {
          id: String(users.length + 1),
          email,
          password: hashPassword(password), // Store hashed password
          name: name || email.split('@')[0],
          createdAt: new Date().toISOString(),
          role: 'user', // Default role
        };

        users.push(newUser);

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = newUser;
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        };
      }

      return createError({
        statusCode: 400,
        message: 'Invalid action',
      });
    } catch (err) {
      console.error('Auth error:', err);
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
