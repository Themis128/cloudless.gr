// Session caching utilities for better performance
interface CachedSession {
  session: any
  expires: number
}

class SessionCache {
  private cache = new Map<string, CachedSession>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  get(token: string): any | null {
    const cached = this.cache.get(token)
    
    if (!cached) return null
    
    if (cached.expires < Date.now()) {
      this.cache.delete(token)
      return null
    }
    
    return cached.session
  }

  set(token: string, session: any, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(token, { session, expires })
  }

  delete(token: string): void {
    this.cache.delete(token)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [token, cached] of this.cache.entries()) {
      if (cached.expires < now) {
        this.cache.delete(token)
      }
    }
  }
}

// Global session cache instance
export const sessionCache = new SessionCache()

// Cleanup expired sessions every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => sessionCache.cleanup(), 10 * 60 * 1000)
}
