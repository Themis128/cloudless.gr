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
  maxRequests: 100, // 100 requests per 15 minutes
  keyPrefix: 'rate_limit:',
  message: 'Too many requests, please try again later.',
}

export function createRateLimit(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config }

  return defineEventHandler(async event => {
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
      const currentCount = await redis.get(key)
      const count = currentCount ? parseInt(currentCount) : 0

      if (count >= finalConfig.maxRequests) {
        // Rate limit exceeded
        const ttl = await redis.ttl(key)
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

      // Increment counter and set expiry
      await redis
        .multi()
        .incr(key)
        .expire(key, Math.ceil(finalConfig.windowMs / 1000))
        .exec()

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
      console.error('Rate limiting error:', error)
    }
  })
}

// Export a default rate limiter for general use
export default createRateLimit()
