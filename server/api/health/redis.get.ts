import { defineEventHandler } from 'h3'
import redis, { isRedisAvailable, getRedisStatus } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  try {
    // Check if Redis is available
    if (!isRedisAvailable()) {
      const status = getRedisStatus()
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        connection: {
          status: 'disconnected',
          error: `Redis is not available. Status: ${status}`
        },
        redis: {
          version: 'Unknown',
          uptime: 0,
          uptimeHuman: '0s',
          connectedClients: 0,
          usedMemory: '0B',
          maxMemory: '0B'
        }
      }
    }

    if (!redis) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        connection: {
          status: 'disconnected',
          error: 'Redis connection not established'
        },
        redis: {
          version: 'Unknown',
          uptime: 0,
          uptimeHuman: '0s',
          connectedClients: 0,
          usedMemory: '0B',
          maxMemory: '0B'
        }
      }
    }
    
    // Test Redis connection
    const startTime = Date.now()
    await redis.ping()
    const responseTime = Date.now() - startTime
    
    // Get basic Redis info
    const info = await redis.info('server')
    const memory = await redis.info('memory')
    
    // Parse Redis info
    const parseInfo = (infoString: string) => {
      const lines = infoString.split('\r\n')
      const parsed: Record<string, string> = {}
      
      lines.forEach(line => {
        const [key, value] = line.split(':')
        if (key && value) {
          parsed[key] = value
        }
      })
      
      return parsed
    }
    
    const serverInfo = parseInfo(info)
    const memoryInfo = parseInfo(memory)
    
    // Check if Redis is healthy based on response time
    const isHealthy = responseTime < 1000 // Less than 1 second
    
    return {
      status: isHealthy ? 'healthy' : 'warning',
      timestamp: new Date().toISOString(),
      connection: {
        status: 'connected',
        responseTime: `${responseTime}ms`,
        isHealthy
      },
      redis: {
        version: serverInfo.redis_version || 'Unknown',
        uptime: parseInt(serverInfo.uptime_in_seconds || '0'),
        uptimeHuman: formatUptime(parseInt(serverInfo.uptime_in_seconds || '0')),
        connectedClients: parseInt(serverInfo.connected_clients || '0'),
        usedMemory: memoryInfo.used_memory_human || '0B',
        maxMemory: memoryInfo.maxmemory_human || '0B'
      }
    }
    
  } catch (error) {
    console.error('Redis health check failed:', error)
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      connection: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      redis: {
        version: 'Unknown',
        uptime: 0,
        uptimeHuman: '0s',
        connectedClients: 0,
        usedMemory: '0B',
        maxMemory: '0B'
      }
    }
  }
})

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
} 