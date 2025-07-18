// server/api/analytics/dashboard.ts
import { defineEventHandler, getQuery } from 'h3'
import { apiRateLimit } from '~/server/middleware/rate-limit-enhanced'
import { analytics } from '~/server/utils/analytics'

export default defineEventHandler(async event => {
  // Apply rate limiting to analytics endpoint
  await apiRateLimit(event)

  try {
    const query = getQuery(event)
    const timeRange = (query.timeRange as 'hour' | 'day' | 'week') || 'day'

    // Get comprehensive dashboard data
    const dashboard = await analytics.getDashboard()

    // Get specific event metrics
    const apiMetrics = await analytics.getMetrics('api_request', timeRange)
    const rateLimitMetrics = await analytics.getMetrics(
      'rate_limit_exceeded',
      timeRange
    )
    const cacheMetrics = await analytics.getMetrics('cache_hit', timeRange)

    // Get performance metrics for key endpoints
    const healthPerformance =
      await analytics.getEndpointPerformance('/api/health')
    const cachePerformance =
      await analytics.getEndpointPerformance('/api/cache')
    const advancedCachePerformance = await analytics.getEndpointPerformance(
      '/api/cache-advanced'
    )

    return {
      success: true,
      timestamp: new Date().toISOString(),
      timeRange,
      dashboard: {
        ...dashboard,
        // Add computed metrics
        averageResponseTime:
          (healthPerformance.avgResponseTime +
            cachePerformance.avgResponseTime +
            advancedCachePerformance.avgResponseTime) /
          3,
        totalErrorRate:
          (healthPerformance.errorRate +
            cachePerformance.errorRate +
            advancedCachePerformance.errorRate) /
          3,
        systemEfficiency:
          dashboard.systemHealth.redisMemory > 0
            ? (dashboard.totalEvents / dashboard.systemHealth.redisMemory) * 100
            : 0,
      },
      metrics: {
        api: apiMetrics,
        rateLimiting: rateLimitMetrics,
        cache: cacheMetrics,
      },
      performance: {
        health: healthPerformance,
        cache: cachePerformance,
        advancedCache: advancedCachePerformance,
      },
      insights: {
        // Generate insights based on data
        topPerformingEndpoint: [
          {
            endpoint: '/api/health',
            avgTime: healthPerformance.avgResponseTime,
          },
          { endpoint: '/api/cache', avgTime: cachePerformance.avgResponseTime },
          {
            endpoint: '/api/cache-advanced',
            avgTime: advancedCachePerformance.avgResponseTime,
          },
        ].sort((a, b) => a.avgTime - b.avgTime)[0],
        systemHealth:
          dashboard.systemHealth.redisMemory < 10
            ? 'Excellent'
            : dashboard.systemHealth.redisMemory < 50
              ? 'Good'
              : 'Warning',
        recommendations: generateRecommendations(
          dashboard,
          apiMetrics,
          rateLimitMetrics
        ),
      },
    }
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      // Analytics dashboard error - could be logged to a proper logging service
      // console.error('Analytics dashboard error:', error)
    }

    if (error.statusCode === 429) {
      return {
        error: 'Rate limit exceeded for analytics endpoint',
        retryAfter: error.data?.retryAfter,
        limit: error.data?.limit,
        remaining: error.data?.remaining,
      }
    }

    return {
      error: error.message || 'Failed to load analytics dashboard',
      status: 'error',
    }
  }
})

const generateRecommendations = (
  dashboard: any,
  apiMetrics: any,
  rateLimitMetrics: any
): string[] => {
  const recommendations = []

  // Memory usage recommendations
  if (dashboard.systemHealth.redisMemory > 50) {
    recommendations.push(
      'Consider increasing Redis memory limit or implementing data cleanup'
    )
  }

  // Rate limiting recommendations
  if (rateLimitMetrics.count > 10) {
    recommendations.push(
      'High rate limit violations detected - consider adjusting limits or investigating abuse'
    )
  }

  // Performance recommendations
  if (apiMetrics.count > 1000) {
    recommendations.push(
      'High API usage detected - consider implementing caching strategies'
    )
  }

  // System health recommendations
  if (dashboard.systemHealth.uptime < 3600) {
    recommendations.push('System recently restarted - monitor for stability')
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'System performing optimally - no immediate actions required'
    )
  }

  return recommendations
}
