// server/utils/redis.ts
import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  if (redis) {
    return redis
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    })

    redis.on('error', error => {
      console.error('Redis connection error:', error)
      redis = null
    })

    redis.on('connect', () => {
      console.log('✅ Connected to Redis')
    })

    redis.on('ready', () => {
      console.log('✅ Redis is ready')
    })

    return redis
  } catch (error) {
    console.error('Failed to create Redis client:', error)
    return null
  }
}

export function closeRedisConnection(): void {
  if (redis) {
    redis.disconnect()
    redis = null
  }
}

export { redis }
