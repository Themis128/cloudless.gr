import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Test database connection
    const startTime = Date.now()
    
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`
    const responseTime = Date.now() - startTime
    
    // Get database statistics
    const userCount = await prisma.user.count()
    const projectCount = await prisma.project.count()
    const sessionCount = await prisma.session.count()
    
    // Check if database is healthy based on response time
    const isHealthy = responseTime < 1000 // Less than 1 second
    
    return {
      status: isHealthy ? 'healthy' : 'warning',
      timestamp: new Date().toISOString(),
      connection: {
        status: 'connected',
        responseTime: `${responseTime}ms`,
        isHealthy
      },
      statistics: {
        users: userCount,
        projects: projectCount,
        sessions: sessionCount
      },
      database: {
        provider: 'sqlite', // Based on your Prisma schema
        url: process.env.DATABASE_URL ? 'configured' : 'not configured'
      }
    }
    
  } catch (error) {
    console.error('Database health check failed:', error)
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      connection: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      statistics: {
        users: 0,
        projects: 0,
        sessions: 0
      },
      database: {
        provider: 'sqlite',
        url: process.env.DATABASE_URL ? 'configured' : 'not configured'
      }
    }
  }
}) 