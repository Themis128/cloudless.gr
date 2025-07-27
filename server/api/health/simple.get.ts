// Simple health check endpoint for initial startup
import { defineEventHandler, setResponseStatus } from 'h3'

export default defineEventHandler(async (event: any) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    message: 'Application is running',
    services: {
      app: 'healthy',
    },
  }

  setResponseStatus(event, 200)
  return health
})
