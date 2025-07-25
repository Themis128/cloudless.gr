// API endpoint for handling user authentication
<<<<<<< HEAD
import crypto from 'crypto'
import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { prisma } from '~/lib/prisma'

// Load environment variables
const JWT_SECRET =
  process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production'
const JWT_EXPIRES_IN = process.env.NUXT_JWT_EXPIRES_IN || '7d' // 7 days
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token'

// Function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// Function to validate JWT token
function validateToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
=======
import crypto from 'crypto';
import { createError, defineEventHandler, readBody, setCookie } from 'h3';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';

// Load environment variables
const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.NUXT_JWT_EXPIRES_IN || '7d'; // 7 days
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token';

// Function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
}

// Function to generate JWT token
function generateToken(user: any): string {
<<<<<<< HEAD
  const { password, ...userWithoutPassword } = user
  return jwt.sign(userWithoutPassword, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  })
}

// Initialize default users if they don't exist
async function initializeDefaultUsers() {
  const existingUsers = await prisma.user.count()

  if (existingUsers === 0) {
    await prisma.user.createMany({
      data: [
        {
          email: 'demo@example.com',
          password: hashPassword('password'),
          name: 'Demo User',
          role: 'user',
        },
        {
          email: 'admin@example.com',
          password: hashPassword('admin123'),
          name: 'Admin User',
          role: 'admin',
        },
      ],
    })
  }
}

// Login handler
export default defineEventHandler(async event => {
  // Initialize default users
  await initializeDefaultUsers()

  // Get request method
  const method = event.node.req.method
=======
  const { password, ...userWithoutPassword } = user;
  return jwt.sign(userWithoutPassword, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Login handler
export default defineEventHandler(async (event) => {
  // Get request method
  const method = event.node.req.method;
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

  // Handle login
  if (method === 'POST') {
    try {
<<<<<<< HEAD
      const body = await readBody(event)
      const { action, email, password, name } = body
=======
      const body = await readBody(event);
      const { action, email, password, name } = body;
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

      if (!email || !password) {
        return createError({
          statusCode: 400,
          message: 'Email and password are required',
<<<<<<< HEAD
        })
      }

      // Login action
      if (action === 'login') {
        // Hash the incoming password to compare with stored hash
        const hashedPassword = hashPassword(password)
=======
        });
      } // Login action
      if (action === 'login') {
        // Hash the incoming password to compare with stored hash
        const hashedPassword = hashPassword(password);

        // Find user in database
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
        const user = await prisma.user.findUnique({
          where: {
            email: email,
          },
<<<<<<< HEAD
        })
=======
        });
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

        if (!user || user.password !== hashedPassword) {
          return createError({
            statusCode: 401,
            message: 'Invalid credentials',
<<<<<<< HEAD
          })
        }

        // Generate JWT token
        const token = generateToken(user)
=======
          });
        }

        // Update last login time
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        // Generate JWT token
        const token = generateToken(user);
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

        // Set HTTP-only cookie with the token
        setCookie(event, COOKIE_NAME, token, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
          sameSite: 'strict',
<<<<<<< HEAD
        })

        // Return user without password
        const { password: _, ...userWithoutPassword } = user
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        }
=======
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        };
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
      }

      // Signup action
      else if (action === 'signup') {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
<<<<<<< HEAD
          where: { email },
        })
=======
          where: { email: email },
        });
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

        if (existingUser) {
          return createError({
            statusCode: 409,
            message: 'Email already exists',
<<<<<<< HEAD
          })
=======
          });
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
        }

        // Validate password
        if (password.length < 6) {
          return createError({
            statusCode: 400,
            message: 'Password must be at least 6 characters',
<<<<<<< HEAD
          })
=======
          });
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
        }

        // Create new user with hashed password
        const newUser = await prisma.user.create({
          data: {
            email,
<<<<<<< HEAD
            password: hashPassword(password),
            name: name || email.split('@')[0],
            role: 'user',
          },
        })

        // Generate JWT token
        const token = generateToken(newUser)
=======
            password: hashPassword(password), // Store hashed password
            name: name || email.split('@')[0],
            role: 'user', // Default role
          },
        });

        // Generate JWT token
        const token = generateToken(newUser);
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

        // Set HTTP-only cookie with the token
        setCookie(event, COOKIE_NAME, token, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
          sameSite: 'strict',
<<<<<<< HEAD
        })

        // Return user without password
        const { password: _, ...userWithoutPassword } = newUser
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        }
=======
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = newUser;
        return {
          user: userWithoutPassword,
          token, // Also return the token for client-side storage if needed
        };
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
      }

      return createError({
        statusCode: 400,
        message: 'Invalid action',
<<<<<<< HEAD
      })
    } catch (error) {
      console.error('Auth error:', error)
      return createError({
        statusCode: 500,
        message: 'Internal server error',
      })
=======
      });
    } catch (error) {
      console.error('Auth error:', error);
      return createError({
        statusCode: 500,
        message: 'Internal server error',
      });
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
    }
  }

  // Method not allowed
  return createError({
    statusCode: 405,
    message: 'Method not allowed',
<<<<<<< HEAD
  })
})
=======
  });
});
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
