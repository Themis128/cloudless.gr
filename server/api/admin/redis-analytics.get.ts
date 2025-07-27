// server/api/admin/redis-analytics.get.ts
import { defineEventHandler, createError } from 'h3'
import { redis, getRedisClient } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  try {
    // Check if Redis is available
    const redisClient = getRedisClient()
    if (!redisClient) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Redis is not available',
      })
    }

    // Test Redis connection
    try {
      await redisClient.ping()
    } catch (error) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Redis connection test failed',
      })
    }
    
    // Get Redis info
    const info = await redisClient.info()
    const memory = await redisClient.info('memory')
    const stats = await redisClient.info('stats')
    
    // Parse memory info
    const memoryLines = memory.split('\r\n')
    const memoryInfo: any = {}
    
    memoryLines.forEach(line => {
      const [key, value] = line.split(':')
      if (key && value) {
        memoryInfo[key] = value
      }
    })
    
    // Parse stats info
    const statsLines = stats.split('\r\n')
    const statsInfo: any = {}
    
    statsLines.forEach(line => {
      const [key, value] = line.split(':')
      if (key && value) {
        statsInfo[key] = value
      }
    })
    
    // Calculate memory usage
    const usedMemory = parseInt(memoryInfo.used_memory || '0')
    const usedMemoryHuman = formatBytes(usedMemory)
    const maxMemory = parseInt(memoryInfo.maxmemory || '0')
    const maxMemoryHuman = formatBytes(maxMemory)
    const memoryUsagePercent = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0
    
    // Get key count - skip for now as dbSize might not be available
    const dbsize = 0
    
    return {
      success: true,
      memory: {
        usedMemory,
        usedMemoryHuman,
        maxMemory,
        maxMemoryHuman,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        peakMemory: parseInt(memoryInfo.used_memory_peak || '0'),
        peakMemoryHuman: formatBytes(parseInt(memoryInfo.used_memory_peak || '0'))
      },
      stats: {
        totalConnections: parseInt(statsInfo.total_connections_received || '0'),
        totalCommands: parseInt(statsInfo.total_commands_processed || '0'),
        keyspaceHits: parseInt(statsInfo.keyspace_hits || '0'),
        keyspaceMisses: parseInt(statsInfo.keyspace_misses || '0'),
        hitRate: calculateHitRate(
          parseInt(statsInfo.keyspace_hits || '0'),
          parseInt(statsInfo.keyspace_misses || '0')
        ),
        currentConnections: parseInt(statsInfo.connected_clients || '0'),
        totalKeys: dbsize
      },
      info: {
        version: memoryInfo.redis_version || 'Unknown',
        uptime: parseInt(memoryInfo.uptime_in_seconds || '0'),
        uptimeHuman: formatUptime(parseInt(memoryInfo.uptime_in_seconds || '0'))
      }
    }
    
  } catch (error) {
    console.error('Error fetching Redis analytics:', error)
    return {
      success: false,
      error: 'Failed to connect to Redis',
      memory: {
        usedMemory: 0,
        usedMemoryHuman: '0B',
        maxMemory: 0,
        maxMemoryHuman: '0B',
        memoryUsagePercent: 0,
        peakMemory: 0,
        peakMemoryHuman: '0B'
      },
      stats: {
        totalConnections: 0,
        totalCommands: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        hitRate: 0,
        currentConnections: 0,
        totalKeys: 0
      },
      info: {
        version: 'Unknown',
        uptime: 0,
        uptimeHuman: '0s'
      }
    }
  }
})

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i]
}

function calculateHitRate(hits: number, misses: number): number {
  const total = hits + misses
  if (total === 0) return 0
  return Math.round((hits / total) * 100 * 100) / 100
}

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