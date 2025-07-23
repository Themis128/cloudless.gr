// server/api/admin/redis-status.get.ts
import { defineEventHandler } from 'h3'
import redis, { isRedisAvailable, getRedisStatus, testRedisConnection } from '~/server/utils/redis'

interface RedisStatus {
  available: boolean
  status: string
  connected: boolean
  timestamp: string
  uptime?: string
  version?: string
}

export default defineEventHandler(async (event): Promise<RedisStatus> => {
  const available = isRedisAvailable()
  const status = getRedisStatus()
  const connected = await testRedisConnection()
  
  const result: RedisStatus = {
    available,
    status,
    connected,
    timestamp: new Date().toISOString()
  }
  
  // If Redis is available and connected, get some basic info
  if (available && connected && redis) {
    try {
      const info = await redis.info()
      const lines = info.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('redis_version:')) {
          result.version = line.split(':')[1]?.trim()
        }
        if (line.startsWith('uptime_in_seconds:')) {
          const uptime = parseInt(line.split(':')[1]?.trim() || '0')
          result.uptime = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
        }
      }
    } catch (error) {
      console.warn('Could not fetch Redis info:', error)
    }
  }
  
  return result
}) 