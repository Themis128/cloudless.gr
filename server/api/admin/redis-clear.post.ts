// server/api/admin/redis-clear.post.ts
import { defineEventHandler, createError } from 'h3'
import redis, { isRedisAvailable } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  try {
    // Check if Redis is available
    if (!isRedisAvailable()) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Redis is not available',
      })
    }

    if (!redis) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Redis connection not established',
      })
    }
    
    // Clear all keys from Redis
    await redis.flushall()
    
    return {
      success: true,
      message: 'Redis cache cleared successfully'
    }
    
  } catch (error) {
    console.error('Error clearing Redis cache:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to clear Redis cache'
    })
  }
}) 