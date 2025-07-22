// API v1 Authentication - Login endpoint
import { defineEventHandler, readBody } from 'h3'
import { prisma } from '~/lib/prisma'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Missing required fields: email and password',
        code: 'MISSING_FIELDS'
      }
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      event.node.res.statusCode = 401
      return {
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    
    if (!isValidPassword) {
      event.node.res.statusCode = 401
      return {
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'
    
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: '24h' }
    )

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    })

    // Return success response
    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        expiresIn: '24h',
        tokenType: 'Bearer'
      },
      message: 'Login successful'
    }

  } catch (error) {
    console.error('Login error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
}) 