import { defineEventHandler, readBody, createError, setCookie, getRequestIP, getHeader } from 'h3'
import { authService } from '~/server/utils/auth-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Validate input
  if (!body.email || !body.password || !body.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email, password, and name are required'
    })
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format'
    })
  }
  
  // Validate password strength
  if (body.password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters long'
    })
  }
  
  try {
    // Get client information
    const ipAddress = getRequestIP(event)
    const userAgent = getHeader(event, 'user-agent')
    
    // Check rate limiting (3 registrations per hour)
    const rateLimitKey = `register:${ipAddress}`
    const rateLimitAllowed = await authService.checkRateLimit(rateLimitKey, 'register', 3, 60)
    
    if (!rateLimitAllowed) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many registration attempts. Please try again later.'
      })
    }
    
    // Attempt registration
    const result = await authService.register(body.email, body.password, body.name, ipAddress, userAgent)
    
    if (!result.success) {
      throw createError({
        statusCode: 409,
        statusMessage: result.error || 'Registration failed'
      })
    }
    
    // Set cookie
    setCookie(event, 'auth-token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    return {
      success: true,
      data: {
        user: result.user,
        token: result.token,
        sessionId: result.sessionId
      }
    }
  } catch (error: any) {
    console.error('Registration error:', error)
    
    // Re-throw if it's already an H3 error
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'An error occurred during registration'
    })
  }
}) 