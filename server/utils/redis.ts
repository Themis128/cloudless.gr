// server/utils/redis.ts
import Redis from 'ioredis'

// Check if we're in CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
const skipRedis = process.env.SKIP_REDIS === 'true' || isCI

let redis: Redis | null = null

if (!skipRedis) {
  redis = new Redis({
    host:
      process.env.NODE_ENV === 'development'
        ? 'cloudlessgr-redis-dev'
        : 'redis',
    port: 6379,
    // password: '', // if used
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // Enable Redis Cluster support if needed
    // enableReadyCheck: true,
    // maxLoadingTimeout: 10000,
  })

  // Handle connection events
  redis.on('connect', () => {
    // Redis connected successfully
  })

  redis.on('error', () => {
    // Redis connection error - could be logged to a proper logging service
    // console.error('❌ Redis connection error:', error)
  })

  redis.on('ready', () => {
    // Redis is ready to accept commands
  })

  redis.on('close', () => {
    // Redis connection closed
  })
} else {
  // Redis disabled (CI environment or SKIP_REDIS=true)
}

// Create a Redis-like interface that works without Redis
const createMockRedis = () => {
  const memoryStore = new Map()

  return {
    async get(key: string) {
      const item = memoryStore.get(key)
      if (!item) return null
      if (item.expiry && Date.now() > item.expiry) {
        memoryStore.delete(key)
        return null
      }
      return item.value
    },

    async set(key: string, value: string) {
      memoryStore.set(key, { value, expiry: null })
      return 'OK'
    },

    async setex(key: string, ttl: number, value: string) {
      memoryStore.set(key, { value, expiry: Date.now() + ttl * 1000 })
      return 'OK'
    },

    async del(key: string) {
      return memoryStore.delete(key) ? 1 : 0
    },

    async expire(key: string, ttl: number) {
      const item = memoryStore.get(key)
      if (item) {
        item.expiry = Date.now() + ttl * 1000
        return 1
      }
      return 0
    },

    async incr(key: string) {
      const current = await this.get(key)
      const newValue = (parseInt(current || '0') + 1).toString()
      await this.set(key, newValue)
      return parseInt(newValue)
    },

    async keys(pattern: string) {
      const regex = new RegExp(pattern.replace('*', '.*'))
      return Array.from(memoryStore.keys()).filter(key => regex.test(key))
    },

    async ttl(key: string) {
      const item = memoryStore.get(key)
      if (!item || !item.expiry) return -1
      const remaining = Math.ceil((item.expiry - Date.now()) / 1000)
      return remaining > 0 ? remaining : -1
    },

    async info() {
      return `# Memory\nused_memory:${memoryStore.size * 100}\nused_memory_human:${memoryStore.size * 100}B`
    },

    async dbsize() {
      return memoryStore.size
    },

    async sadd(key: string, member: string) {
      const set = memoryStore.get(key) || new Set()
      if (typeof set === 'string') return 0
      set.add(member)
      memoryStore.set(key, set)
      return 1
    },

    async scard(key: string) {
      const set = memoryStore.get(key)
      if (typeof set === 'string' || !set) return 0
      return set.size
    },

    async lpush(key: string, value: string) {
      const list = memoryStore.get(key) || []
      if (!Array.isArray(list)) return 0
      list.unshift(value)
      memoryStore.set(key, list)
      return list.length
    },

    async lrange(key: string, start: number, end: number) {
      const list = memoryStore.get(key) || []
      if (!Array.isArray(list)) return []
      return list.slice(start, end === -1 ? undefined : end + 1)
    },

    async ltrim(key: string, start: number, end: number) {
      const list = memoryStore.get(key) || []
      if (!Array.isArray(list)) return 'OK'
      const trimmed = list.slice(start, end === -1 ? undefined : end + 1)
      memoryStore.set(key, trimmed)
      return 'OK'
    },

    async hset(key: string, field: string | object, value?: string) {
      const hash = memoryStore.get(key) || {}
      if (typeof field === 'object') {
        Object.assign(hash, field)
      } else {
        hash[field] = value
      }
      memoryStore.set(key, hash)
      return 'OK'
    },

    async hgetall(key: string) {
      const hash = memoryStore.get(key) || {}
      return hash
    },

    async multi() {
      return {
        exec: async () => {
          return [['OK']]
        },
      }
    },

    on() {
      // Mock event handling
      return this
    },
  }
}

// Export the Redis instance or mock
export default redis || createMockRedis()
