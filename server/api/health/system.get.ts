import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Get system information
    const startTime = process.uptime()
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Calculate memory usage percentages
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external
    const usedMemory = memoryUsage.heapUsed + memoryUsage.external
    const memoryUsagePercent = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0
    
    // Check if system is healthy based on memory usage
    const isHealthy = memoryUsagePercent < 90
    
    return {
      status: isHealthy ? 'healthy' : 'warning',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(startTime),
        human: formatUptime(startTime)
      },
      memory: {
        used: formatBytes(usedMemory),
        total: formatBytes(totalMemory),
        percentage: Math.round(memoryUsagePercent * 100) / 100,
        heapUsed: formatBytes(memoryUsage.heapUsed),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        external: formatBytes(memoryUsage.external)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }
    
  } catch (error) {
    console.error('Error fetching system health:', error)
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch system health data'
    }
  }
})

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i]
}

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
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