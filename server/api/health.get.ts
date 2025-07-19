// Enhanced health check endpoint for Docker and monitoring
import { createClient } from '@supabase/supabase-js'
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
      config: {
        supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
        nodeEnv: process.env.NODE_ENV,
        nitroHost: process.env.NITRO_HOST,
        nitroPort: process.env.NITRO_PORT,
      },
    }

    // Check Supabase connectivity if configured
    if (
      process.env.NUXT_PUBLIC_SUPABASE_URL &&
      process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
        
        // Create Supabase client for health check
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Test connection by making a simple query
        const { data, error } = await supabase
          .from('_supabase_migrations')
          .select('version')
          .limit(1)

        if (error) {
          // If migrations table doesn't exist, try a different approach
          // Just test the connection without requiring specific functions
          const { data: testData, error: testError } = await supabase
            .from('_supabase_migrations')
            .select('*')
            .limit(0)

          if (testError && testError.code !== 'PGRST116') {
            health.checks.supabase = 'error'
            health.supabaseError = testError.message
            health.status = 'degraded'
          } else {
            health.checks.supabase = 'connected'
            health.supabaseStatus = 'Connection successful'
          }
        } else {
          health.checks.supabase = 'connected'
          health.supabaseMigrations = data?.length || 0
        }
      } catch (error) {
        health.checks.supabase = 'error'
        health.supabaseError = error instanceof Error ? error.message : 'Unknown error'
        health.status = 'degraded'
      }
    } else {
      health.checks.supabase = 'not_configured'
      health.supabaseError = 'Missing NUXT_PUBLIC_SUPABASE_URL or NUXT_PUBLIC_SUPABASE_ANON_KEY'
    }

    // Check Redis connectivity if configured
    if (process.env.REDIS_URL) {
      try {
        // Simple Redis check - you can enhance this with actual Redis client
        health.checks.redis = 'configured'
      } catch (error) {
        health.checks.redis = 'error'
        health.status = 'degraded'
      }
    } else {
      health.checks.redis = 'not_configured'
    }

    // Check if any critical services are down
    const criticalServices = Object.values(health.checks).filter(
      status => status === 'error'
    )
    
    // In development, be more lenient with health checks
    if (process.env.NODE_ENV === 'development') {
      if (criticalServices.length > 0) {
        health.status = 'degraded' // Use degraded instead of unhealthy in dev
      }
    } else {
      if (criticalServices.length > 0) {
        health.status = 'unhealthy'
      }
    }

    // Add response time
    health.responseTime = Date.now() - startTime

    // Set appropriate HTTP status code
    if (health.status === 'healthy') {
      event.node.res.statusCode = 200
    } else if (health.status === 'degraded') {
      event.node.res.statusCode = 200 // Still 200 but with degraded status
    } else {
      // In development, return 200 even for unhealthy to avoid container restarts
      if (process.env.NODE_ENV === 'development') {
        event.node.res.statusCode = 200
      } else {
        event.node.res.statusCode = 503
      }
    }

    return health
  } catch (error) {
    event.node.res.statusCode = 503
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
      config: {
        supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
        nodeEnv: process.env.NODE_ENV,
      },
    }
  }
})
