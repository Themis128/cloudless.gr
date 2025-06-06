import { defineEventHandler, readBody, setCookie } from 'h3'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cloudless.gr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set in environment variables. Using default (not recommended for production)')
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.warn('Admin credentials not configured in environment variables. Using defaults.')
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required'
      }
    }    // Check admin credentials
    const isValidEmail = email === ADMIN_EMAIL
    const isValidPassword = password === ADMIN_PASSWORD

    console.log('Admin login attempt:', {
      providedEmail: email,
      expectedEmail: ADMIN_EMAIL,
      emailMatch: isValidEmail,
      passwordMatch: isValidPassword
    })

    if (!isValidEmail || !isValidPassword) {
      console.log('Invalid admin credentials provided')
      return {
        success: false,
        message: 'Invalid credentials'
      }
    }

    // Generate JWT token
    const payload = {
      id: 'admin-1',
      email: ADMIN_EMAIL,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }

    const token = jwt.sign(payload, JWT_SECRET)

    // Set HTTP-only cookie for security
    setCookie(event, 'admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: '/'
    })

    return {
      success: true,
      message: 'Admin login successful',
      user: {
        id: 'admin-1',
        email: ADMIN_EMAIL,
        role: 'admin'
      },
      token // Also return token for client-side storage if needed
    }

  } catch (error) {
    console.error('Admin login error:', error)
    return {
      success: false,
      message: 'An error occurred during login'
    }
  }
})
