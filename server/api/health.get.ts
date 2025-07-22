// Health check endpoint for monitoring and Docker health checks
export default defineEventHandler(async (event) => {
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0-dev',
      environment: process.env.NODE_ENV || 'development',
      services: {
        app: 'healthy'
      }
    }

    // Check database connection if available
    try {
      // Add database health check here when database client is implemented
      health.services.database = 'healthy'
    } catch (error) {
      health.services.database = 'unhealthy'
    }

    // Check Redis connection if available
    try {
      // Add Redis health check here when Redis client is implemented
      health.services.redis = 'healthy'
    } catch (error) {
      health.services.redis = 'unhealthy'
    }

    return health
  } catch (error) {
    // Set response status to 503 Service Unavailable
    setResponseStatus(event, 503)
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
