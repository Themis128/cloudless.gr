// server/utils/analytics.ts
import redis from './redis'

interface AnalyticsEvent {
  event: string
  userId?: string
  sessionId?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, any>
  timestamp: string
}

interface MetricData {
  count: number
  uniqueUsers: number
  lastUpdated: string
  hourly?: Record<string, number>
  daily?: Record<string, number>
}

export class Analytics {
  private prefix = 'analytics:'
  private eventsPrefix = 'events:'
  private metricsPrefix = 'metrics:'

  /**
   * Track an analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    }

    const eventKey = `${this.eventsPrefix}${event.event}:${Date.now()}`
    const hourKey = `${this.metricsPrefix}${event.event}:hour:${this.getHourKey()}`
    const dayKey = `${this.metricsPrefix}${event.event}:day:${this.getDayKey()}`

    // Store event details
    await redis.setex(eventKey, 86400 * 7, JSON.stringify(fullEvent)) // 7 days TTL

    // Increment hourly counter
    await redis.incr(hourKey)
    await redis.expire(hourKey, 86400 * 30) // 30 days TTL

    // Increment daily counter
    await redis.incr(dayKey)
    await redis.expire(dayKey, 86400 * 365) // 1 year TTL

    // Track unique users (if userId provided)
    if (event.userId) {
      const uniqueKey = `${this.metricsPrefix}${event.event}:unique:${this.getDayKey()}`
      await redis.sadd(uniqueKey, event.userId)
      await redis.expire(uniqueKey, 86400 * 30)
    }

    // Track IP addresses for security
    if (event.ip) {
      const ipKey = `${this.metricsPrefix}${event.event}:ips:${this.getDayKey()}`
      await redis.sadd(ipKey, event.ip)
      await redis.expire(ipKey, 86400 * 7)
    }
  }

  /**
   * Get real-time metrics for an event
   */
  async getMetrics(
    eventName: string,
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<MetricData> {
    const now = new Date()
    const metrics: MetricData = {
      count: 0,
      uniqueUsers: 0,
      lastUpdated: now.toISOString(),
    }

    if (timeRange === 'hour') {
      const hourKey = `${this.metricsPrefix}${eventName}:hour:${this.getHourKey()}`
      const count = await redis.get(hourKey)
      metrics.count = count ? parseInt(count) : 0
    } else if (timeRange === 'day') {
      const dayKey = `${this.metricsPrefix}${eventName}:day:${this.getDayKey()}`
      const count = await redis.get(dayKey)
      metrics.count = count ? parseInt(count) : 0

      // Get unique users for today
      const uniqueKey = `${this.metricsPrefix}${eventName}:unique:${this.getDayKey()}`
      metrics.uniqueUsers = await redis.scard(uniqueKey)
    } else if (timeRange === 'week') {
      // Aggregate last 7 days
      const counts = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(now.getTime() - i * 86400 * 1000)
        const dayKey = `${this.metricsPrefix}${eventName}:day:${this.formatDate(date)}`
        const count = await redis.get(dayKey)
        counts.push(count ? parseInt(count) : 0)
      }
      metrics.count = counts.reduce((sum, count) => sum + count, 0)
      metrics.daily = Object.fromEntries(
        counts
          .map((count, i) => {
            const date = new Date(now.getTime() - i * 86400 * 1000)
            return [this.formatDate(date), count]
          })
          .reverse()
      )
    }

    return metrics
  }

  /**
   * Get system-wide analytics dashboard
   */
  async getDashboard(): Promise<{
    totalEvents: number
    activeUsers: number
    topEvents: Array<{ event: string; count: number }>
    recentActivity: AnalyticsEvent[]
    systemHealth: {
      redisMemory: number
      totalKeys: number
      uptime: number
    }
  }> {
    // Get all event keys
    const eventKeys = await redis.keys(`${this.eventsPrefix}*`)
    const totalEvents = eventKeys.length

    // Get active users (unique users in last 24 hours)
    const activeUsersKey = `${this.metricsPrefix}active_users:${this.getDayKey()}`
    const activeUsers = await redis.scard(activeUsersKey)

    // Get top events
    const metricKeys = await redis.keys(
      `${this.metricsPrefix}*:day:${this.getDayKey()}`
    )
    const topEvents = []
    for (const key of metricKeys.slice(0, 10)) {
      const eventName = key.split(':')[1]
      const count = await redis.get(key)
      if (count) {
        topEvents.push({ event: eventName, count: parseInt(count) })
      }
    }
    topEvents.sort((a, b) => b.count - a.count)

    // Get recent activity (last 10 events)
    const recentEvents = []
    const recentKeys = eventKeys.slice(-10).reverse()
    for (const key of recentKeys) {
      const eventData = await redis.get(key)
      if (eventData) {
        recentEvents.push(JSON.parse(eventData))
      }
    }

    // System health
    const memoryInfo = await redis.info('memory')
    const memoryMatch = memoryInfo.match(/used_memory_human:(\d+)/)
    const redisMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0
    const totalKeys = await redis.dbsize()
    const uptime = process.uptime()

    return {
      totalEvents,
      activeUsers,
      topEvents,
      recentActivity: recentEvents,
      systemHealth: {
        redisMemory,
        totalKeys,
        uptime,
      },
    }
  }

  /**
   * Track API performance metrics
   */
  async trackAPIPerformance(
    endpoint: string,
    duration: number,
    statusCode: number
  ): Promise<void> {
    await this.trackEvent({
      event: 'api_request',
      metadata: {
        endpoint,
        duration,
        statusCode,
        success: statusCode < 400,
      },
    })

    // Track response times
    const responseTimeKey = `${this.metricsPrefix}response_time:${endpoint}:${this.getHourKey()}`
    await redis.lpush(responseTimeKey, duration.toString())
    await redis.ltrim(responseTimeKey, 0, 999) // Keep last 1000 requests
    await redis.expire(responseTimeKey, 86400 * 7)
  }

  /**
   * Get performance metrics for an endpoint
   */
  async getEndpointPerformance(endpoint: string): Promise<{
    avgResponseTime: number
    totalRequests: number
    errorRate: number
    p95ResponseTime: number
  }> {
    const responseTimeKey = `${this.metricsPrefix}response_time:${endpoint}:${this.getHourKey()}`
    const responseTimes = await redis.lrange(responseTimeKey, 0, -1)
    const times = responseTimes.map(t => parseFloat(t)).filter(t => !isNaN(t))

    if (times.length === 0) {
      return {
        avgResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        p95ResponseTime: 0,
      }
    }

    const avgResponseTime =
      times.reduce((sum, time) => sum + time, 0) / times.length
    const sortedTimes = times.sort((a, b) => a - b)
    const p95Index = Math.floor(times.length * 0.95)
    const p95ResponseTime = sortedTimes[p95Index]

    // Get error rate from recent events
    const errorKey = `${this.metricsPrefix}api_request:errors:${this.getHourKey()}`
    const totalKey = `${this.metricsPrefix}api_request:total:${this.getHourKey()}`
    const errors = (await redis.get(errorKey)) || '0'
    const total = (await redis.get(totalKey)) || '0'
    const errorRate =
      parseInt(total) > 0 ? (parseInt(errors) / parseInt(total)) * 100 : 0

    return {
      avgResponseTime,
      totalRequests: times.length,
      errorRate,
      p95ResponseTime,
    }
  }

  private getHourKey(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`
  }

  private getDayKey(): string {
    return this.formatDate(new Date())
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
}

// Export default instance
export const analytics = new Analytics()
