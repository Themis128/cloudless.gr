import { defineEventHandler } from 'h3'
import { usePrisma } from '~/composables/usePrisma'

export default defineEventHandler(async (event) => {
  try {
    const prisma = usePrisma()
    
    // Test database connection
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - startTime

    // Get some basic stats
    const botCount = await prisma.bot.count()
    const projectCount = await prisma.project.count()
    const userCount = await prisma.profile.count()

    return {
      success: true,
      data: {
        status: 'healthy',
        database: 'postgresql',
        connected: true,
        responseTime: `${responseTime}ms`,
        stats: {
          bots: botCount,
          projects: projectCount,
          users: userCount
        },
        timestamp: new Date().toISOString()
      }
    }

  } catch (error: any) {
    console.error('Database health check failed:', error)
    
    return {
      success: false,
      data: {
        status: 'unhealthy',
        database: 'postgresql',
        connected: false,
        error: error?.message || 'Unknown database error',
        timestamp: new Date().toISOString()
      }
    }
  }
}) 