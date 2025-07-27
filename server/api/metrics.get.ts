// Metrics endpoint for monitoring
import { defineEventHandler, setResponseStatus } from 'h3'

export default defineEventHandler(async (event: any) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
    },
    cpu: {
      usage: process.cpuUsage(),
    },
    version: '1.0.0',
    status: 'healthy',
  }

  setResponseStatus(event, 200)
  return metrics
})
