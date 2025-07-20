// server/middleware/rate-limit-enhanced.ts
import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { analytics } from '~/server/utils/analytics'
import redis from '~/server/utils/redis'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix: string
  message?: string
  // Enhanced features
  burstLimit?: number // Allow burst of requests
  slidingWindow?: boolean // Use sliding window instead of fixed window
  userBased?: boolean // Rate limit per user instead of IP
  whitelist?: string[] // IPs or user IDs to whitelist
  blacklist?: string[] // IPs or user IDs to blacklist
  trackAnalytics?: boolean // Track rate limit events
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyPrefix: 'rate_limit:',
  message: 'Too many requests, please try again later.',
  burstLimit: 50,
  slidingWindow: true,
  userBased: false,
  whitelist: [],
  blacklist: [],
  trackAnalytics: true,
}

export const createEnhancedRateLimit = (
  config: Partial<RateLimitConfig> = {}
) => {
  const finalConfig = { ...defaultConfig, ...config }

  return defineEventHandler(async event => {
    const startTime = Date.now()

    try {
      // Get client identifier
      const clientIP =
        getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
        getRequestHeader(event, 'x-real-ip') ||
        event.node.req.socket?.remoteAddress ||
        'unknown'

      const userId = getRequestHeader(event, 'x-user-id') || null
      const identifier = finalConfig.userBased && userId ? userId : clientIP

      // Check whitelist
      if (finalConfig.whitelist?.includes(identifier)) {
        return // Allow request
      }

      // Check blacklist
      if (finalConfig.blacklist?.includes(identifier)) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Access denied',
        })
      }

      // Create rate limit keys
      const now = Date.now()
      const windowStart = finalConfig.slidingWindow
        ? now - finalConfig.windowMs
        : Math.floor(now / finalConfig.windowMs) * finalConfig.windowMs

      const key = `${finalConfig.keyPrefix}${identifier}:${Math.floor(windowStart / finalConfig.windowMs)}`
      const burstKey = `${finalConfig.keyPrefix}burst:${identifier}`

      // Check burst limit first
      const burstCount = await redis.get(burstKey)
      if (
        burstCount &&
        parseInt(burstCount) >= (finalConfig.burstLimit || 10)
      ) {
        if (finalConfig.trackAnalytics) {
          await analytics.trackEvent({
            event: 'rate_limit_burst_exceeded',
            ip: clientIP,
            userId: userId || undefined,
            metadata: {
              identifier,
              burstLimit: finalConfig.burstLimit,
              endpoint: event.path,
            },
          })
        }

        throw createError({
          statusCode: 429,
          statusMessage: 'Burst limit exceeded. Please slow down.',
          data: {
            retryAfter: 60, // 1 minute
            limit: finalConfig.burstLimit,
            remaining: 0,
            type: 'burst',
          },
        })
      }

      // Get current request count
      const currentCount = await redis.get(key)
      const count = currentCount ? parseInt(currentCount) : 0

      if (count >= finalConfig.maxRequests) {
        // Rate limit exceeded
        const ttl = await redis.ttl(key)

        if (finalConfig.trackAnalytics) {
          await analytics.trackEvent({
            event: 'rate_limit_exceeded',
            ip: clientIP,
            userId: userId || undefined,
            metadata: {
              identifier,
              limit: finalConfig.maxRequests,
              endpoint: event.path,
              ttl,
            },
          })
        }

        throw createError({
          statusCode: 429,
          statusMessage: finalConfig.message,
          data: {
            retryAfter: ttl,
            limit: finalConfig.maxRequests,
            remaining: 0,
            type: 'window',
          },
        })
      }

      // Increment counters
      const multi = redis.multi()

      // Increment main counter
      multi.incr(key)
      multi.expire(key, Math.ceil(finalConfig.windowMs / 1000))

      // Increment burst counter
      multi.incr(burstKey)
      multi.expire(burstKey, 60) // 1 minute TTL for burst

      await multi.exec()

      // Track successful request
      if (finalConfig.trackAnalytics) {
        await analytics.trackEvent({
          event: 'rate_limit_request',
          ip: clientIP,
          userId: userId || undefined,
          metadata: {
            identifier,
            endpoint: event.path,
            remaining: finalConfig.maxRequests - count - 1,
          },
        })
      }

      // Set rate limit headers
      const remaining = Math.max(0, finalConfig.maxRequests - count - 1)
      const resetTime =
        Math.floor(windowStart / finalConfig.windowMs) * finalConfig.windowMs +
        finalConfig.windowMs

      event.node.res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests)
      event.node.res.setHeader('X-RateLimit-Remaining', remaining)
      event.node.res.setHeader('X-RateLimit-Reset', resetTime)
      event.node.res.setHeader(
        'X-RateLimit-Burst-Limit',
        finalConfig.burstLimit || 10
      )
      event.node.res.setHeader(
        'X-RateLimit-Burst-Remaining',
        Math.max(
          0,
          (finalConfig.burstLimit || 10) - (parseInt(burstCount || '0') + 1)
        )
      )

      // Track API performance
      const duration = Date.now() - startTime
      await analytics.trackAPIPerformance(event.path, duration, 200)
    } catch (error: any) {
      if (error.statusCode === 429 || error.statusCode === 403) {
        throw error
      }

      // If Redis is down, log but don't block requests
      // Enhanced rate limiting error - could be logged to a proper logging service
      // console.error('Enhanced rate limiting error:', error)

      // Track API performance even on errors
      const duration = Date.now() - startTime
      await analytics.trackAPIPerformance(event.path, duration, 500)
    }
  })
}

// Export pre-configured rate limiters for common use cases
export const apiRateLimit = createEnhancedRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 120, // 120 requests per minute
  keyPrefix: 'api_rate_limit:',
  burstLimit: 30,
  message: 'API rate limit exceeded. Please try again later.',
})

export const authRateLimit = createEnhancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
  keyPrefix: 'auth_rate_limit:',
  burstLimit: 5,
  message: 'Too many authentication attempts. Please try again later.',
})

export const uploadRateLimit = createEnhancedRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 uploads per minute
  keyPrefix: 'upload_rate_limit:',
  burstLimit: 8,
  message: 'Upload rate limit exceeded. Please try again later.',
})

// Development rate limiter - much more lenient
export const devRateLimit = createEnhancedRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 requests per minute
  keyPrefix: 'dev_rate_limit:',
  burstLimit: 200,
  message: 'Development rate limit exceeded.',
})

// Export default enhanced rate limiter
export default createEnhancedRateLimit()
