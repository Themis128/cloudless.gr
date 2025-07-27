import { computed } from 'vue'

// Enhanced stores composable that provides access to all advanced store features
export const useEnhancedStores = () => {
  const persistenceStore = usePersistenceStore()
  const globalStateStore = useGlobalStateStore()
  const cacheStore = useCacheStore()
  const errorHandlingStore = useErrorHandlingStore()
  const performanceStore = usePerformanceStore()

  // Cross-store computed properties
  const appHealth = computed(() => {
    const systemHealth = globalStateStore.systemHealth
    const errorStats = errorHandlingStore.getErrorStats
    const performanceStats = performanceStore.getAPICallStats
    const memoryStats = performanceStore.getMemoryStats

    return {
      system: systemHealth,
      errors: errorStats,
      performance: performanceStats,
      memory: memoryStats,
      overall: {
        health: systemHealth.overall.health,
        hasCriticalErrors: errorStats.bySeverity.critical > 0,
        isPerformingWell: performanceStats.successRate > 95,
        memoryUsage: memoryStats.current?.percentage || 0,
      },
    }
  })

  const userContext = computed(() => {
    const userStats = globalStateStore.userStats
    const userPermissions = globalStateStore.userPermissions
    const authStore = useAuthStore()

    return {
      stats: userStats,
      permissions: userPermissions,
      isAuthenticated: authStore.isAuthenticated,
      isAdmin: authStore.isAdmin,
      canManageBots: userPermissions.includes('manage_bots'),
      canManagePipelines: userPermissions.includes('manage_pipelines'),
      canViewAnalytics: userPermissions.includes('view_analytics'),
    }
  })

  // Enhanced API operations with caching and error handling
  const enhancedFetch = async <T>(
    endpoint: string,
    options?: any,
    cacheOptions?: {
      ttl?: number
      tags?: string[]
      skipCache?: boolean
    }
  ): Promise<T> => {
    const cacheKey = `api_${options?.method || 'GET'}_${endpoint}`

    // Check cache first (unless skipCache is true)
    if (
      !cacheOptions?.skipCache &&
      options?.method !== 'POST' &&
      options?.method !== 'PUT' &&
      options?.method !== 'DELETE'
    ) {
      const cached = cacheStore.getCached<T>(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const result = await performanceStore.measureAsync(
        `api_${endpoint}`,
        () => $fetch<T>(endpoint, options),
        'api'
      )

      // Cache successful responses
      if (result && !cacheOptions?.skipCache) {
        cacheStore.setCached(
          cacheKey,
          result,
          cacheOptions?.ttl,
          cacheOptions?.tags
        )
      }

      return result
    } catch (error: any) {
      // Let error handling store manage the error
      errorHandlingStore.addError(error, { endpoint, options }, 'medium', 'api')
      throw error
    }
  }

  // Enhanced data operations with automatic persistence
  const persistData = (storeName: string, data: any) => {
    persistenceStore.saveState(storeName, data)
  }

  const loadPersistedData = (storeName: string) => {
    return persistenceStore.loadState(storeName)
  }

  // Cache management utilities
  const warmCache = async (
    config: Array<{
      key: string
      fetcher: () => Promise<any>
      ttl?: number
      tags?: string[]
    }>
  ) => {
    await cacheStore.warmCache(config)
  }

  const invalidateCacheByTags = (tags: string[]) => {
    cacheStore.invalidateCache(undefined, tags)
  }

  const getCacheStats = () => {
    return cacheStore.getCacheStats
  }

  // Error management utilities
  const handleError = (
    error: Error | string,
    context?: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    return errorHandlingStore.addError(error, context, severity)
  }

  const getUnresolvedErrors = () => {
    return errorHandlingStore.getUnresolvedErrors
  }

  const retryErrorsByCategory = async (category: string) => {
    return await errorHandlingStore.retryErrorsByCategory(category)
  }

  // Performance monitoring utilities
  const trackPerformance = (
    name: string,
    value: number,
    unit: string,
    category: string
  ) => {
    performanceStore.addMetric(name, value, unit, category)
  }

  const getPerformanceReport = () => {
    return performanceStore.getPerformanceReport()
  }

  const startPerformanceTimer = (name: string) => {
    return performanceStore.createTimer(name)
  }

  // Global state utilities
  const refreshAllData = async () => {
    return await globalStateStore.refreshAllData()
  }

  const getUserDashboardData = async (userId: number) => {
    return await globalStateStore.getUserDashboardData(userId)
  }

  // Batch operations
  const batchOperations = {
    // Batch cache operations
    cache: {
      get: cacheStore.batchGet,
      set: cacheStore.batchSet,
    },

    // Batch error operations
    errors: {
      retryByCategory: retryErrorsByCategory,
      clearResolved: errorHandlingStore.clearResolvedErrors,
    },

    // Batch performance operations
    performance: {
      clearOldData: performanceStore.clearOldData,
    },
  }

  // Export utilities for debugging
  const exportAllData = () => {
    return {
      persistence: persistenceStore.getStorageStats(),
      cache: cacheStore.exportCache(),
      errors: errorHandlingStore.exportErrors(),
      performance: performanceStore.exportPerformanceData(),
      globalState: {
        userStats: globalStateStore.userStats,
        systemHealth: globalStateStore.systemHealth,
        recentActivity: globalStateStore.recentActivity,
      },
    }
  }

  // Health check utility
  const performHealthCheck = async () => {
    const health = appHealth.value

    const checks = {
      system: health.system.overall.health > 80,
      errors: health.errors.unresolved === 0,
      performance: health.performance.successRate > 95,
      memory: health.memory.current?.percentage < 90,
    }

    const allHealthy = Object.values(checks).every(check => check)

    return {
      healthy: allHealthy,
      checks,
      details: health,
    }
  }

  return {
    // Stores
    persistence: persistenceStore,
    globalState: globalStateStore,
    cache: cacheStore,
    errorHandling: errorHandlingStore,
    performance: performanceStore,

    // Computed properties
    appHealth,
    userContext,

    // Enhanced operations
    enhancedFetch,
    persistData,
    loadPersistedData,

    // Cache utilities
    warmCache,
    invalidateCacheByTags,
    getCacheStats,

    // Error utilities
    handleError,
    getUnresolvedErrors,
    retryErrorsByCategory,

    // Performance utilities
    trackPerformance,
    getPerformanceReport,
    startPerformanceTimer,

    // Global state utilities
    refreshAllData,
    getUserDashboardData,

    // Batch operations
    batchOperations,

    // Utility functions
    exportAllData,
    performHealthCheck,
  }
}
