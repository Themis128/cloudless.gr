<<<<<<< HEAD
// server/middleware/rate-limit.ts
import { createError, defineEventHandler, getRequestHeader } from 'h3'
import redis from '~/server/utils/redis'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix: string // Redis key prefix
  message?: string // Error message
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: process.env.TESTING === 'true' ? 10000 : 100, // Very high limit for testing
  keyPrefix: 'rate_limit:',
  message: 'Too many requests, please try again later.',
}

export const createRateLimit = (config: Partial<RateLimitConfig> = {}) => {
  const finalConfig = { ...defaultConfig, ...config }

  return defineEventHandler(async event => {
    // Skip rate limiting in test environment or development
    if (process.env.NODE_ENV === 'test' || 
        process.env.TESTING === 'true' || 
        process.env.NODE_ENV === 'development') {
      return // Allow all requests during testing and development
    }

    try {
      // Get client IP (with fallbacks for different proxy setups)
      const clientIP =
        getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
        getRequestHeader(event, 'x-real-ip') ||
        event.node.req.socket?.remoteAddress ||
        'unknown'

      // Create rate limit key
      const key = `${finalConfig.keyPrefix}${clientIP}:${Math.floor(Date.now() / finalConfig.windowMs)}`

      // Get current request count
      const currentCount = await redis?.get?.(key)
      const count = currentCount ? parseInt(currentCount) : 0

      if (count >= finalConfig.maxRequests) {
        // Rate limit exceeded
        const ttl = await redis?.ttl?.(key) ?? -1
        throw createError({
          statusCode: 429,
          statusMessage: finalConfig.message,
          data: {
            retryAfter: ttl,
            limit: finalConfig.maxRequests,
            remaining: 0,
          },
        })
      }

      // Increment counter and set expiry, only if redis is available
      if (redis) {
        await redis.incr(key)
        await redis.expire(key, Math.ceil(finalConfig.windowMs / 1000))
      }

      // Set rate limit headers
      event.node.res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests)
      event.node.res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, finalConfig.maxRequests - count - 1)
      )
      event.node.res.setHeader(
        'X-RateLimit-Reset',
        Math.floor(Date.now() / finalConfig.windowMs) * finalConfig.windowMs +
          finalConfig.windowMs
      )
    } catch (error: any) {
      if (error.statusCode === 429) {
        throw error
      }
      // If Redis is down, log but don't block requests
      // Rate limiting error - could be logged to a proper logging service
      // console.error('Rate limiting error:', error)
    }
  })
}

// Export a default rate limiter for general use
export default createRateLimit()
=======
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
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
