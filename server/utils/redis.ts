// server/utils/redis.ts
import Redis from 'ioredis'

// Check if we're in CI environment or if Redis should be skipped
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
const skipRedis = process.env.SKIP_REDIS === 'true' || isCI

let redis: Redis | null = null

// Initialize Redis - only use real Redis, no mock fallback
if (skipRedis) {
  console.log('ℹ️ Redis disabled (SKIP_REDIS=true or CI environment)')
  redis = null
} else {
  try {
    // Connect to real Redis only
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    
    console.log(`🔗 Connecting to Redis at: ${redisUrl.replace(/\/\/.*@/, '//***@')}`)
    
    redis = new Redis(redisUrl, {
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false, // Connect immediately
      retryDelayOnFailover: 100,
      connectTimeout: 10000,
    })
    
    redis.on('connect', () => {
      console.log('✅ Connected to Redis')
    })
    
    redis.on('ready', () => {
      console.log('✅ Redis is ready')
    })
    
    redis.on('error', (err: any) => {
      console.error('❌ Redis connection error:', err.message)
      // Don't fall back to mock Redis - keep it null
      redis = null
    })
    
    redis.on('close', () => {
      console.warn('⚠️ Redis connection closed')
      redis = null
    })
    
    redis.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...')
    })
    
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error)
    redis = null
  }
}

// Add a method to check if Redis is available
export const isRedisAvailable = (): boolean => {
  return redis !== null && redis.status === 'ready'
}

// Add a method to get Redis connection status
export const getRedisStatus = (): string => {
  if (!redis) return 'disconnected'
  return redis.status
}

// Add a method to test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  if (!redis) return false
  
  try {
    await redis.ping()
    return true
  } catch (error) {
    console.error('Redis ping failed:', error)
    return false
  }
}

// Export the Redis instance
export default redis
