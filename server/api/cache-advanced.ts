// server/api/cache-advanced.ts
import { defineEventHandler, getRequestHeader } from 'h3'
import { createRateLimit } from '~/server/middleware/rate-limit'
import redis from '~/server/utils/redis'
import { sessionCache } from '~/server/utils/session-cache'

// Apply rate limiting to this endpoint
const rateLimiter = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyPrefix: 'cache_advanced:',
  message: 'Too many requests to cache endpoint',
})

export default defineEventHandler(async event => {
  // Apply rate limiting
  await rateLimiter(event)

  try {
    const clientIP =
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      getRequestHeader(event, 'x-real-ip') ||
      event.node.req.socket?.remoteAddress ||
      'unknown'

    // Create a mock session for demonstration
    const sessionId = `demo_${Date.now()}`
    const mockSession = {
      userId: 'demo_user_123',
      email: 'demo@cloudless.gr',
      role: 'developer',
      permissions: ['read', 'write', 'cache'],
      lastActivity: new Date().toISOString(),
    }

    // Store session in Redis
    await sessionCache.setSession(sessionId, mockSession)

    // Demonstrate various Redis operations
    const operations = {
      // String operations
      string_ops: {
        set: await redis.set('demo:string', 'Hello from Cloudless!'),
        get: await redis.get('demo:string'),
        setex: await redis.setex('demo:temp', 60, 'Temporary data'),
        ttl: await redis.ttl('demo:temp'),
      },

      // List operations
      list_ops: {
        lpush: await redis.lpush('demo:list', 'item1', 'item2', 'item3'),
        lrange: await redis.lrange('demo:list', 0, -1),
        llen: await redis.llen('demo:list'),
      },

      // Hash operations
      hash_ops: {
        hset: await redis.hset('demo:hash', {
          name: 'Cloudless LLM Dev Agent',
          version: '1.0.0',
          features: 'Redis, Rate Limiting, Sessions',
        }),
        hgetall: await redis.hgetall('demo:hash'),
        hget: await redis.hget('demo:hash', 'name'),
      },

      // Set operations
      set_ops: {
        sadd: await redis.sadd('demo:set', 'member1', 'member2', 'member3'),
        smembers: await redis.smembers('demo:set'),
        scard: await redis.scard('demo:set'),
      },

      // Session operations
      session_ops: {
        stored: await sessionCache.getSession(sessionId),
        stats: await sessionCache.getStats(),
      },

      // Performance metrics
      performance: {
        memory_usage: await redis.info('memory').then(info => {
          const match = info.match(/used_memory_human:(\d+)/)
          return match ? parseInt(match[1]) : 0
        }),
        keyspace: await redis.info('keyspace'),
        total_keys: await redis.dbsize(),
      },
    }

    // Clean up demo session
    await sessionCache.deleteSession(sessionId)

    return {
      success: true,
      timestamp: new Date().toISOString(),
      client_ip: clientIP,
      session_id: sessionId,
      operations,
      message: 'Advanced Redis operations completed successfully!',
    }
  } catch (error: any) {
    console.error('Advanced cache error:', error)

    if (error.statusCode === 429) {
      return {
        error: 'Rate limit exceeded',
        retryAfter: error.data?.retryAfter,
        limit: error.data?.limit,
        remaining: error.data?.remaining,
      }
    }

    return {
      error: error.message || 'Unknown error occurred',
      status: 'error',
    }
  }
})
