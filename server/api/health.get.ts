// Health check endpoint for monitoring and Docker health checks
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

// Cache health check results for 60 seconds to improve performance
let healthCache: any = null
let cacheTimestamp = 0
const CACHE_DURATION = 60000 // 60 seconds

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const forceRefresh = query.refresh === 'true'

  // Return cached result if available and not expired
  const now = Date.now()
  if (!forceRefresh && healthCache && now - cacheTimestamp < CACHE_DURATION) {
    setResponseStatus(event, healthCache.status === 'healthy' ? 200 : 503)
    return healthCache
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    services: {
      app: 'healthy',
      database: 'unknown',
      redis: 'unknown',
    },
    performance: {
      responseTime: 0,
      cacheHit: !forceRefresh && healthCache !== null,
    },
  }

  const startTime = Date.now()

  try {
    // Parallel service checks with shorter timeouts for better performance
    const [dbResult, redisResult] = await Promise.allSettled([checkDatabase(), checkRedis()])

    // Process database result
    if (dbResult.status === 'fulfilled') {
      health.services.database = 'healthy'
    } else {
      console.error('Database health check failed:', dbResult.reason)
      health.services.database = 'unhealthy'
      health.status = 'unhealthy'
    }

    // Process Redis result
    if (redisResult.status === 'fulfilled') {
      health.services.redis = 'healthy'
    } else {
      console.error('Redis health check failed:', redisResult.reason)
      health.services.redis = 'unhealthy'
      // Don't mark overall health as unhealthy for Redis issues
    }
  } catch (error) {
    console.error('Health check failed:', error)
    health.status = 'unhealthy'
  }

  // Calculate response time
  health.performance.responseTime = Date.now() - startTime

  // Cache the result
  healthCache = health
  cacheTimestamp = now

  // Set response status based on overall health
  if (health.status === 'healthy') {
    setResponseStatus(event, 200)
  } else {
    setResponseStatus(event, 503)
  }

  return health
})

async function checkDatabase() {
  const prisma = getPrismaClient()

  // Use a shorter timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Database check timeout')), 2000)
  })

  const dbCheckPromise = prisma.$queryRaw`SELECT 1`

  return Promise.race([dbCheckPromise, timeoutPromise])
}

async function checkRedis() {
  const { redis } = await import('~/server/utils/redis')
  if (!redis) {
    return Promise.resolve('unavailable')
  }

  // Use a shorter timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Redis check timeout')), 1000)
  })

  const redisCheckPromise = redis.ping()

  return Promise.race([redisCheckPromise, timeoutPromise])
}
