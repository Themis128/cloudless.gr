import { defineEventHandler, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const health = await databaseService.healthCheck()
    
    if (health.connected) {
      return {
        success: true,
        data: {
          ...health,
          timestamp: new Date().toISOString()
        },
        message: 'Prisma database connection is healthy'
      }
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: 'Database health check failed',
        data: { 
          ...health,
          timestamp: new Date().toISOString()
        }
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database health check failed',
      data: { 
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    })
  }
})