// server/api/cache.ts
import { defineEventHandler } from 'h3'
import redis from '~/server/utils/redis'

export default defineEventHandler(async (event: any) => {
  try {
    // Test Redis connection and basic operations
    await redis.set('hello', 'world')
    const value = await redis.get('hello')

    // Add some additional test data
    await redis.set('timestamp', new Date().toISOString())
    await redis.set('app_name', 'Cloudless LLM Dev Agent')
    await redis.set('redis_test', 'success')

    // Test list operations
    await redis.lpush('recent_actions', 'cache_test')
    await redis.lpush('recent_actions', 'api_call')
    const recentActions = await redis.lrange('recent_actions', 0, -1)

    // Test hash operations
    await redis.hset('user:test', {
      name: 'Test User',
      email: 'test@cloudless.gr',
      last_login: new Date().toISOString(),
    })
    const userData = await redis.hgetall('user:test')

    return {
      message: value,
      timestamp: await redis.get('timestamp'),
      app_name: await redis.get('app_name'),
      redis_test: await redis.get('redis_test'),
      recent_actions: recentActions,
      user_data: userData,
      status: 'success',
    }
  } catch (error) {
    console.error('Redis cache error:', error)
    return {
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      status: 'error',
    }
  }
})
