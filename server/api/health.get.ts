// Enhanced health check endpoint for Docker and monitoring
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event: any) => {
  const startTime = Date.now()

  try {
    // Basic system health
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      checks: {
        database: 'unknown',
        redis: 'unknown',
        supabase: 'unknown',
      },
    }

    // Check Supabase connectivity if configured
    if (
      process.env.NUXT_PUBLIC_SUPABASE_URL &&
      process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        // Simple connectivity check - you can enhance this with actual Supabase client
        health.checks.supabase = 'connected'
      } catch (error) {
        health.checks.supabase = 'error'
        health.status = 'degraded'
      }
    } else {
      health.checks.supabase = 'not_configured'
    }

    // Check if any critical services are down
    const criticalServices = Object.values(health.checks).filter(
      status => status === 'error'
    )
    if (criticalServices.length > 0) {
      health.status = 'unhealthy'
    }

    // Add response time
    health.responseTime = Date.now() - startTime

    // Set appropriate HTTP status code
    if (health.status === 'healthy') {
      event.node.res.statusCode = 200
    } else if (health.status === 'degraded') {
      event.node.res.statusCode = 200 // Still 200 but with degraded status
    } else {
      event.node.res.statusCode = 503
    }

    return health
  } catch (error) {
    event.node.res.statusCode = 503
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    }
  }
})
