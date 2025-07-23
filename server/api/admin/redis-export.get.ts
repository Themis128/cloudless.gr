// server/api/admin/redis-export.get.ts
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
    
    // Get comprehensive Redis metrics
    const info = await redis.info()
    const memory = await redis.info('memory')
    const stats = await redis.info('stats')
    const server = await redis.info('server')
    
    // Parse the info sections
    const parseInfo = (infoString: string) => {
      const lines = infoString.split('\r\n')
      const parsed: any = {}
      
      lines.forEach(line => {
        const [key, value] = line.split(':')
        if (key && value) {
          parsed[key] = value
        }
      })
      
      return parsed
    }
    
    const metrics = {
      timestamp: new Date().toISOString(),
      server: parseInfo(server),
      memory: parseInfo(memory),
      stats: parseInfo(stats),
      info: parseInfo(info)
    }
    
    return {
      success: true,
      metrics
    }
    
  } catch (error) {
    console.error('Error exporting Redis metrics:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to export Redis metrics'
    })
  }
}) 