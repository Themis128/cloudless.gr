import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  timestamp: number
  category: string
  metadata?: any
}

interface APICallMetric {
  endpoint: string
  method: string
  duration: number
  status: number
  timestamp: number
  success: boolean
  error?: string
}

interface ComponentMetric {
  name: string
  renderTime: number
  mountTime: number
  updateCount: number
  lastUpdate: number
}

interface MemoryMetric {
  used: number
  total: number
  limit: number
  timestamp: number
}

export const usePerformanceStore = defineStore('performance', () => {
  const metrics = ref<PerformanceMetric[]>([])
  const apiCalls = ref<APICallMetric[]>([])
  const componentMetrics = ref<Map<string, ComponentMetric>>(new Map())
  const memoryMetrics = ref<MemoryMetric[]>([])
  const isMonitoring = ref(false)

  // Start performance monitoring
  const startMonitoring = () => {
    isMonitoring.value = true

    // Start memory monitoring
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      setInterval(() => {
        trackMemoryUsage()
      }, 10000) // Every 10 seconds
    }
  }

  // Stop performance monitoring
  const stopMonitoring = () => {
    isMonitoring.value = false
  }

  // Track API call performance
  const trackAPICall = (
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    success: boolean,
    error?: string
  ) => {
    const apiCall: APICallMetric = {
      endpoint,
      method,
      duration,
      status,
      timestamp: Date.now(),
      success,
      error,
    }

    apiCalls.value.push(apiCall)

    // Keep only last 1000 API calls
    if (apiCalls.value.length > 1000) {
      apiCalls.value = apiCalls.value.slice(-1000)
    }
  }

  // Track component performance
  const trackComponentPerformance = (
    name: string,
    renderTime: number,
    mountTime: number
  ) => {
    const existing = componentMetrics.value.get(name)

    if (existing) {
      existing.renderTime = renderTime
      existing.mountTime = mountTime
      existing.updateCount++
      existing.lastUpdate = Date.now()
    } else {
      componentMetrics.value.set(name, {
        name,
        renderTime,
        mountTime,
        updateCount: 1,
        lastUpdate: Date.now(),
      })
    }
  }

  // Track memory usage
  const trackMemoryUsage = () => {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory
      const memoryMetric: MemoryMetric = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        timestamp: Date.now(),
      }

      memoryMetrics.value.push(memoryMetric)

      // Keep only last 100 memory metrics
      if (memoryMetrics.value.length > 100) {
        memoryMetrics.value = memoryMetrics.value.slice(-100)
      }
    }
  }

  // Add custom metric
  const addMetric = (
    name: string,
    value: number,
    unit: string,
    category: string,
    metadata?: any
  ) => {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      metadata,
    }

    metrics.value.push(metric)

    // Keep only last 500 metrics
    if (metrics.value.length > 500) {
      metrics.value = metrics.value.slice(-500)
    }
  }

  // Get API call statistics
  const getAPICallStats = computed(() => {
    if (apiCalls.value.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        averageDuration: 0,
        successRate: 0,
      }
    }

    const total = apiCalls.value.length
    const successful = apiCalls.value.filter(call => call.success).length
    const failed = total - successful
    const totalDuration = apiCalls.value.reduce(
      (sum, call) => sum + call.duration,
      0
    )
    const averageDuration = totalDuration / total

    return {
      total,
      successful,
      failed,
      averageDuration: Math.round(averageDuration),
      successRate: (successful / total) * 100,
    }
  })

  // Get slowest API calls
  const getSlowestAPICalls = computed(() => {
    return [...apiCalls.value]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
  })

  // Get API calls by endpoint
  const getAPICallsByEndpoint = (endpoint: string) => {
    return apiCalls.value.filter(call => call.endpoint.includes(endpoint))
  }

  // Get component performance statistics
  const getComponentStats = computed(() => {
    const components = Array.from(componentMetrics.value.values())

    if (components.length === 0) {
      return {
        total: 0,
        averageRenderTime: 0,
        averageMountTime: 0,
        slowestComponents: [],
      }
    }

    const totalRenderTime = components.reduce(
      (sum, comp) => sum + comp.renderTime,
      0
    )
    const totalMountTime = components.reduce(
      (sum, comp) => sum + comp.mountTime,
      0
    )
    const averageRenderTime = totalRenderTime / components.length
    const averageMountTime = totalMountTime / components.length

    const slowestComponents = [...components]
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, 5)

    return {
      total: components.length,
      averageRenderTime: Math.round(averageRenderTime),
      averageMountTime: Math.round(averageMountTime),
      slowestComponents,
    }
  })

  // Get memory usage statistics
  const getMemoryStats = computed(() => {
    if (memoryMetrics.value.length === 0) {
      return {
        current: null,
        average: null,
        trend: 'stable',
      }
    }

    const current = memoryMetrics.value[memoryMetrics.value.length - 1]
    const average =
      memoryMetrics.value.reduce((sum, metric) => sum + metric.used, 0) /
      memoryMetrics.value.length

    // Calculate trend (last 10 measurements)
    const recent = memoryMetrics.value.slice(-10)
    const trend =
      recent.length >= 2
        ? recent[recent.length - 1].used > recent[0].used
          ? 'increasing'
          : 'decreasing'
        : 'stable'

    return {
      current: {
        used: Math.round(current.used / 1024 / 1024), // MB
        total: Math.round(current.total / 1024 / 1024), // MB
        limit: Math.round(current.limit / 1024 / 1024), // MB
        percentage: Math.round((current.used / current.limit) * 100),
      },
      average: Math.round(average / 1024 / 1024), // MB
      trend,
    }
  })

  // Get performance report
  const getPerformanceReport = () => {
    const apiStats = getAPICallStats.value
    const componentStats = getComponentStats.value
    const memoryStats = getMemoryStats.value

    return {
      timestamp: Date.now(),
      api: apiStats,
      components: componentStats,
      memory: memoryStats,
      metrics: {
        total: metrics.value.length,
        categories: [...new Set(metrics.value.map(m => m.category))],
      },
    }
  }

  // Clear old data
  const clearOldData = (maxAge: number = 24 * 60 * 60 * 1000) => {
    // 24 hours
    const cutoff = Date.now() - maxAge

    apiCalls.value = apiCalls.value.filter(call => call.timestamp > cutoff)
    metrics.value = metrics.value.filter(metric => metric.timestamp > cutoff)
    memoryMetrics.value = memoryMetrics.value.filter(
      metric => metric.timestamp > cutoff
    )
  }

  // Export performance data
  const exportPerformanceData = () => {
    return {
      apiCalls: apiCalls.value,
      metrics: metrics.value,
      componentMetrics: Array.from(componentMetrics.value.values()),
      memoryMetrics: memoryMetrics.value,
      report: getPerformanceReport(),
    }
  }

  // Performance monitoring utilities
  const createTimer = (name: string) => {
    const startTime = performance.now()

    return {
      end: (category: string = 'custom', metadata?: any) => {
        const duration = performance.now() - startTime
        addMetric(name, duration, 'ms', category, metadata)
        return duration
      },
    }
  }

  const measureAsync = async <T>(
    name: string,
    asyncFn: () => Promise<T>,
    category: string = 'async'
  ): Promise<T> => {
    const timer = createTimer(name)
    try {
      const result = await asyncFn()
      timer.end(category)
      return result
    } catch (error) {
      timer.end(category, {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return {
    // State
    isMonitoring,

    // Core operations
    startMonitoring,
    stopMonitoring,
    trackAPICall,
    trackComponentPerformance,
    addMetric,

    // Computed properties
    getAPICallStats,
    getSlowestAPICalls,
    getComponentStats,
    getMemoryStats,

    // Utility methods
    getAPICallsByEndpoint,
    getPerformanceReport,
    clearOldData,
    exportPerformanceData,
    createTimer,
    measureAsync,
  }
})
