// Rate limiter for authentication endpoints
import { defineEventHandler, getRequestIP, createError } from 'h3'

// Simple in-memory rate limiting (in production, use Redis or similar)
const attempts = new Map<string, { count: number; timestamp: number }>()
const MAX_ATTEMPTS = 5 // Max attempts within window
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes window
const BLOCKED_DURATION_MS = 30 * 60 * 1000 // 30 minutes block

export default defineEventHandler((event) => {
  // Skip if not an auth endpoint
  const path = event.node.req.url || ''
  if (!path.startsWith('/api/auth/') || path === '/api/auth/verify' || path === '/api/auth/refresh-token') {
    return
  }

  // Get client IP
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  
  // Get current time
  const now = Date.now()
  
  // Check if IP is in the attempts map
  if (attempts.has(ip)) {
    const record = attempts.get(ip)!
    
    // Check if window has expired
    if (now - record.timestamp > WINDOW_MS) {
      // Reset if window expired
      attempts.set(ip, { count: 1, timestamp: now })
      return
    }
    
    // Check if IP should be blocked
    if (record.count >= MAX_ATTEMPTS) {
      // Calculate remaining block time
      const blockedUntil = record.timestamp + BLOCKED_DURATION_MS
      if (now < blockedUntil) {
        const remainingMs = blockedUntil - now
        const remainingMinutes = Math.ceil(remainingMs / 60000)
        
        throw createError({
          statusCode: 429,
          statusMessage: 'Too Many Requests',
          message: `Too many login attempts. Please try again in ${remainingMinutes} minutes.`
        })
      } else {
        // Reset after block duration
        attempts.set(ip, { count: 1, timestamp: now })
        return
      }
    }
    
    // Increment attempt count
    record.count++
    attempts.set(ip, record)
  } else {
    // First attempt
    attempts.set(ip, { count: 1, timestamp: now })
  }
  
  // Clean up old entries every hour
  if (Math.random() < 0.01) { // 1% chance per request to avoid doing this too often
    const cutoff = now - WINDOW_MS - BLOCKED_DURATION_MS
    for (const [key, value] of attempts.entries()) {
      if (value.timestamp < cutoff) {
        attempts.delete(key)
      }
    }
  }
})
