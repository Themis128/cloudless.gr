import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  key: string
  tags?: string[]
}

interface CacheConfig {
  defaultTTL: number
  maxSize: number
  enableCompression: boolean
}

export const useCacheStore = defineStore('cache', () => {
  const cache = ref(new Map<string, CacheEntry>())
  const cacheStats = ref({
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
  })

  const config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    enableCompression: false,
  }

  // Get cached data with TTL check
  const getCached = <T>(key: string): T | null => {
    const entry = cache.value.get(key)

    if (!entry) {
      cacheStats.value.misses++
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.value.delete(key)
      cacheStats.value.misses++
      return null
    }

    cacheStats.value.hits++
    return entry.data as T
  }

  // Set cached data
  const setCached = <T>(
    key: string,
    data: T,
    ttl?: number,
    tags?: string[]
  ) => {
    // Check cache size limit
    if (cache.value.size >= config.maxSize) {
      evictOldest()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || config.defaultTTL,
      key,
      tags,
    }

    cache.value.set(key, entry)
    cacheStats.value.size = cache.value.size
  }

  // Evict oldest entries when cache is full
  const evictOldest = () => {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of cache.value) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      cache.value.delete(oldestKey)
      cacheStats.value.evictions++
      cacheStats.value.size = cache.value.size
    }
  }

  // Invalidate cache by pattern or tags
  const invalidateCache = (pattern?: string, tags?: string[]) => {
    const keysToDelete: string[] = []

    for (const [key, entry] of cache.value) {
      let shouldDelete = false

      // Check pattern match
      if (pattern && key.includes(pattern)) {
        shouldDelete = true
      }

      // Check tag match
      if (tags && entry.tags) {
        const hasMatchingTag = tags.some(tag => entry.tags!.includes(tag))
        if (hasMatchingTag) {
          shouldDelete = true
        }
      }

      if (shouldDelete) {
        keysToDelete.push(key)
      }
    }

    // Delete matched entries
    keysToDelete.forEach(key => {
      cache.value.delete(key)
    })

    cacheStats.value.size = cache.value.size
  }

  // Clear all cache
  const clearCache = () => {
    cache.value.clear()
    cacheStats.value.size = 0
  }

  // Get cache statistics
  const getCacheStats = computed(() => {
    const totalRequests = cacheStats.value.hits + cacheStats.value.misses
    const hitRate =
      totalRequests > 0 ? (cacheStats.value.hits / totalRequests) * 100 : 0

    return {
      ...cacheStats.value,
      hitRate: hitRate.toFixed(2) + '%',
      totalRequests,
      currentSize: cache.value.size,
      maxSize: config.maxSize,
    }
  })

  // Get cache entries by tag
  const getEntriesByTag = (tag: string) => {
    const entries: CacheEntry[] = []

    for (const entry of cache.value.values()) {
      if (entry.tags && entry.tags.includes(tag)) {
        entries.push(entry)
      }
    }

    return entries
  }

  // Preload cache with data
  const preloadCache = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ) => {
    try {
      const data = await fetcher()
      setCached(key, data, ttl, tags)
      return data
    } catch (error) {
      console.error(`Failed to preload cache for key: ${key}`, error)
      throw error
    }
  }

  // Cache with automatic refresh
  const getCachedWithRefresh = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ): Promise<T> => {
    // Try to get from cache first
    const cached = getCached<T>(key)
    if (cached !== null) {
      return cached
    }

    // If not in cache, fetch and cache
    return await preloadCache(key, fetcher, ttl, tags)
  }

  // Batch cache operations
  const batchGet = <T>(keys: string[]): Map<string, T | null> => {
    const results = new Map<string, T | null>()

    keys.forEach(key => {
      results.set(key, getCached<T>(key))
    })

    return results
  }

  const batchSet = <T>(
    entries: Array<{ key: string; data: T; ttl?: number; tags?: string[] }>
  ) => {
    entries.forEach(({ key, data, ttl, tags }) => {
      setCached(key, data, ttl, tags)
    })
  }

  // Cache warming for frequently accessed data
  const warmCache = async (
    warmupConfig: Array<{
      key: string
      fetcher: () => Promise<any>
      ttl?: number
      tags?: string[]
    }>
  ) => {
    const promises = warmupConfig.map(config =>
      preloadCache(config.key, config.fetcher, config.ttl, config.tags)
    )

    try {
      await Promise.all(promises)
      console.log(`Cache warmed with ${warmupConfig.length} entries`)
    } catch (error) {
      console.error('Failed to warm cache:', error)
    }
  }

  // Export cache for debugging
  const exportCache = () => {
    const exportData: any = {}

    for (const [key, entry] of cache.value) {
      exportData[key] = {
        data: entry.data,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        tags: entry.tags,
        age: Date.now() - entry.timestamp,
      }
    }

    return exportData
  }

  return {
    // Core cache operations
    getCached,
    setCached,
    invalidateCache,
    clearCache,

    // Advanced operations
    getCachedWithRefresh,
    preloadCache,
    batchGet,
    batchSet,
    warmCache,

    // Utility methods
    getCacheStats,
    getEntriesByTag,
    exportCache,

    // Configuration
    config,
  }
})
