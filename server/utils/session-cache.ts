// Session cache utility with mock Redis implementation
// In a real app, you would use the actual Redis client

interface SessionData {
  userId: string
  email: string
  role: string
  permissions: string[]
  lastActivity: string
  [key: string]: any
}

interface SessionStats {
  totalSessions: number
  activeSessions: number
  memoryUsage: string
}

class MockSessionCache {
  private sessions: Map<string, { data: SessionData; ttl: number }> = new Map()
  private ttl: number = 3600 // 1 hour default

  constructor(ttl: number = 3600) {
    this.ttl = ttl
  }

  async setSession(sessionId: string, data: SessionData): Promise<void> {
    const expiresAt = Date.now() + this.ttl * 1000
    this.sessions.set(sessionId, { data, ttl: expiresAt })
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if (Date.now() > session.ttl) {
      this.sessions.delete(sessionId)
      return null
    }

    return session.data
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async extendSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      const expiresAt = Date.now() + this.ttl * 1000
      this.sessions.set(sessionId, { data: session.data, ttl: expiresAt })
    }
  }

  async getAllSessions(): Promise<{ [key: string]: SessionData }> {
    const result: { [key: string]: SessionData } = {}
    const now = Date.now()

    for (const [key, session] of this.sessions.entries()) {
      if (now <= session.ttl) {
        result[key] = session.data
      } else {
        this.sessions.delete(key)
      }
    }

    return result
  }

  async getStats(): Promise<SessionStats> {
    const now = Date.now()
    let activeSessions = 0

    for (const session of this.sessions.values()) {
      if (now <= session.ttl) {
        activeSessions++
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      memoryUsage: `${this.sessions.size * 1024} bytes` // Mock memory usage
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    for (const [key, session] of this.sessions.entries()) {
      if (now > session.ttl) {
        this.sessions.delete(key)
      }
    }
  }
}

// Export singleton instance
export const sessionCache = new MockSessionCache()

// Export class for testing
export { MockSessionCache }
