// API endpoint for admin authentication
import { defineEventHandler, readBody, setCookie, createError } from 'h3'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'

// Load environment variables
const JWT_SECRET = process.env.NUXT_JWT_SECRET || 'your-secret-key-change-this-in-production'
const JWT_EXPIRES_IN = process.env.NUXT_JWT_EXPIRES_IN || '7d' // 7 days
const COOKIE_NAME = process.env.NUXT_AUTH_COOKIE_NAME || 'auth_token'

// Function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// Function to generate JWT token  
function generateToken(user: any): string {
  const { password, ...userWithoutPassword } = user
  return jwt.sign(userWithoutPassword, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Admin credentials (in real production, this would be in a database)
// In this example, we're using the credentials mentioned in README: admin/cloudless2025
const adminUser = {
  id: 'admin-1',
  email: 'admin@cloudless.gr',
  username: 'admin',
  password: hashPassword('cloudless2025'), // Store hashed password
  name: 'Admin User',
  createdAt: '2025-01-01T00:00:00Z',
  role: 'admin'
}

export default defineEventHandler(async (event) => {
  // Only accept POST requests
  const method = event.node.req.method
  if (method !== 'POST') {
    return createError({
      statusCode: 405,
      message: 'Method not allowed'
    })
  }

  try {
    const body = await readBody(event)
    const { username, password } = body

    if (!username || !password) {
      return createError({
        statusCode: 400,
        message: 'Username and password are required'
      })
    }

    // For admin login, check both username or email
    const isUsernameMatch = adminUser.username === username
    const isEmailMatch = adminUser.email === username
    const isPasswordMatch = adminUser.password === hashPassword(password)
    
    // Check if credentials match admin user
    if ((isUsernameMatch || isEmailMatch) && isPasswordMatch) {
      // Generate JWT token with admin role
      const token = generateToken(adminUser)
      
      // Set HTTP-only cookie with the token
      setCookie(event, COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'strict'
      })

      // Return user without password
      const { password: _, ...userWithoutPassword } = adminUser
      return {
        user: userWithoutPassword,
        token // Also return the token for client-side storage if needed
      }
    }
    
    return createError({
      statusCode: 401,
      message: 'Invalid admin credentials'
    })
  } catch (error) {
    return createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
