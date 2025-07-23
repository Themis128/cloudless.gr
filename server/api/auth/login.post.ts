import { defineEventHandler, readBody, readRawBody, createError, setCookie, getRequestIP, getHeader, getHeaders } from 'h3'
import { authService } from '~/server/utils/auth-service'

export default defineEventHandler(async (event) => {
  console.log('Login endpoint called')
  
  let body
  try {
    body = await readBody(event)
    console.log('Login request body:', body)
  } catch (error) {
    console.error('Error reading body:', error)
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }
  
  // Validate input
  if (!body.email || !body.password) {
    console.log('Missing email or password:', { email: !!body.email, password: !!body.password })
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required'
    })
  }
  
  try {
    // Get client information
    const ipAddress = getRequestIP(event)
    const userAgent = getHeader(event, 'user-agent')
    
    // Skip rate limiting in development and testing
    if (process.env.NODE_ENV !== 'production') {
      // Skip rate limiting for development and testing
    } else {
      // Check rate limiting (5 attempts per 15 minutes) - only in production
      const rateLimitKey = `login:${ipAddress}`
      const rateLimitAllowed = await authService.checkRateLimit(rateLimitKey, 'login', 5, 15)
      
      if (!rateLimitAllowed) {
        throw createError({
          statusCode: 429,
          statusMessage: 'Too many login attempts. Please try again later.'
        })
      }
    }
    
    // Attempt login
    const result = await authService.login(body.email, body.password, ipAddress, userAgent)
    
    if (!result.success) {
      throw createError({
        statusCode: 401,
        statusMessage: result.error || 'Login failed'
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
      user: result.user,
      token: result.token,
      sessionId: result.sessionId
    }
  } catch (error: any) {
    console.error('Login error:', error)
    
    // Re-throw if it's already an H3 error
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'An error occurred during login'
    })
  }
}) 