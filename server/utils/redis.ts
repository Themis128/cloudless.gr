// server/utils/redis.ts
import Redis from 'ioredis'

const redis = new Redis({
  host:
    process.env.NODE_ENV === 'development' ? 'cloudlessgr-redis-dev' : 'redis',
  port: 6379,
  // password: '', // if used
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Enable Redis Cluster support if needed
  // enableReadyCheck: true,
  // maxLoadingTimeout: 10000,
})

// Handle connection events
redis.on('connect', () => {
  console.log('✅ Redis connected successfully')
})

redis.on('error', error => {
  console.error('❌ Redis connection error:', error)
})

redis.on('ready', () => {
  console.log('🚀 Redis is ready to accept commands')
})

redis.on('close', () => {
  console.log('🔌 Redis connection closed')
})

export default redis
