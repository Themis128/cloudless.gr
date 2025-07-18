// Health check endpoint for Docker and monitoring
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event: any) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  }
}) 