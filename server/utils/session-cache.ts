// server/utils/session-cache.ts
import redis from './redis'

interface SessionData {
  userId: string
  email: string
  role: string
  permissions: string[]
  lastActivity: string
  [key: string]: any
}

export class SessionCache {
  private prefix = 'session:'
  private ttl = 3600 // 1 hour default

  constructor(ttlSeconds?: number) {
    if (ttlSeconds) {
      this.ttl = ttlSeconds
    }
  }

  /**
   * Store session data in Redis
   */
  async setSession(sessionId: string, data: SessionData): Promise<void> {
    const key = `${this.prefix}${sessionId}`
    await redis.setex(key, this.ttl, JSON.stringify(data))
  }

  /**
   * Get session data from Redis
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = `${this.prefix}${sessionId}`
    const data = await redis.get(key)

    if (!data) {
      return null
    }

    try {
      const sessionData = JSON.parse(data) as SessionData

      // Update last activity
      sessionData.lastActivity = new Date().toISOString()
      await this.setSession(sessionId, sessionData)

      return sessionData
    } catch (error) {
      // Error parsing session data - could be logged to a proper logging service
      // console.error('Error parsing session data:', error)
      return null
    }
  }

  /**
   * Delete session from Redis
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`
    await redis.del(key)
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`
    await redis.expire(key, this.ttl)
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<string[]> {
    const pattern = `${this.prefix}*`
    const keys = await redis.keys(pattern)
    const sessions: string[] = []

    for (const key of keys) {
      const data = await redis.get(key)
      if (data) {
        try {
          const sessionData = JSON.parse(data) as SessionData
          if (sessionData.userId === userId) {
            sessions.push(key.replace(this.prefix, ''))
          }
        } catch (error) {
          // Error parsing session data - could be logged to a proper logging service
          // console.error('Error parsing session data:', error)
        }
      }
    }

    return sessions
  }

  /**
   * Clear all sessions for a user
   */
  async clearUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId)
    for (const sessionId of sessions) {
      await this.deleteSession(sessionId)
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number
    activeSessions: number
    memoryUsage: number
  }> {
    const pattern = `${this.prefix}*`
    const keys = await redis.keys(pattern)
    const totalSessions = keys.length

    let activeSessions = 0
    for (const key of keys) {
      const ttl = await redis.ttl(key)
      if (ttl > 0) {
        activeSessions++
      }
    }

    const memoryInfo = await redis.info('memory')
    const memoryUsage = parseInt(
      memoryInfo.match(/used_memory_human:(\d+)/)?.[1] || '0'
    )

    return {
      totalSessions,
      activeSessions,
      memoryUsage,
    }
  }
}

// Export default instance
export const sessionCache = new SessionCache()
