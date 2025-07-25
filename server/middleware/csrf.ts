// CSRF protection middleware for authentication endpoints
import { defineEventHandler, getHeader, createError, getCookie, getMethod } from 'h3'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

export default defineEventHandler((event) => {
  // Only apply to mutation endpoints and auth endpoints
  const path = event.node.req.url || ''
  const method = getMethod(event)
  
  // Skip for non-mutation methods or non-auth endpoints
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || 
      !path.startsWith('/api/auth/') || path === '/api/auth/verify') {
    return
  }
  
  // Skip for the initial CSRF token request itself
  if (path === '/api/auth/csrf' && method === 'POST') {
    return
  }

  // Get CSRF token from cookie and header
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME)
  const headerToken = getHeader(event, CSRF_HEADER_NAME)
  
  // No CSRF token or tokens don't match
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'CSRF token validation failed'
    })
  }
})
