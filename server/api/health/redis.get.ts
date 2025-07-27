import { defineEventHandler } from 'h3'
import { getRedisClient } from '~/server/utils/redis'

export default defineEventHandler(async (_event) => {
  // Redis health check logic will be implemented here
  return {
    success: true,
    message: 'Redis is healthy',
    status: 'healthy'
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
