export const useBotDebug = () => {
  const { $devtools } = useNuxtApp()

  // Type assertion for devtools
  const devtools = $devtools as any

  // Log bot actions for debugging
  const logBotAction = (action: string, botId: number, details?: any) => {
    const logData = {
      action,
      botId,
      timestamp: new Date().toISOString(),
      details,
    }

    console.log(`[Bot Debug] ${action}:`, logData)

    // Send to devtools if available
    if (devtools && typeof devtools.log === 'function') {
      devtools.log(`Bot ${action}: ${botId}`, logData)
    }
  }

  // Log bot performance metrics
  const logBotPerformance = (botId: number, metrics: any) => {
    const logData = {
      botId,
      timestamp: new Date().toISOString(),
      metrics,
    }

    console.log(`[Bot Performance] Bot ${botId}:`, logData)

    if (devtools && typeof devtools.log === 'function') {
      devtools.log(`Bot Performance: ${botId}`, logData)
    }
  }

  // Log bot errors
  const logBotError = (botId: number, error: any, context?: any) => {
    const logData = {
      botId,
      timestamp: new Date().toISOString(),
      error: error.message || error,
      stack: error.stack,
      context,
    }

    console.error(`[Bot Error] Bot ${botId}:`, logData)

    if (devtools && typeof devtools.log === 'function') {
      devtools.log(`Bot Error: ${botId}`, logData, 'error')
    }
  }

  // Track bot state changes
  const trackBotStateChange = (
    botId: number,
    oldState: string,
    newState: string
  ) => {
    const logData = {
      botId,
      oldState,
      newState,
      timestamp: new Date().toISOString(),
    }

    console.log(
      `[Bot State Change] Bot ${botId}: ${oldState} → ${newState}`,
      logData
    )

    if (devtools && typeof devtools.log === 'function') {
      devtools.log(`Bot State Change: ${botId}`, logData)
    }
  }

  // Debug bot configuration
  const debugBotConfig = (botId: number, config: any) => {
    const logData = {
      botId,
      timestamp: new Date().toISOString(),
      config: JSON.parse(JSON.stringify(config)), // Deep clone to avoid reference issues
    }

    console.log(`[Bot Config] Bot ${botId}:`, logData)

    if (devtools && typeof devtools.log === 'function') {
      devtools.log(`Bot Config: ${botId}`, logData)
    }
  }

  // Performance monitoring
  const startPerformanceTimer = (botId: number, operation: string) => {
    const startTime = performance.now()

    return {
      end: () => {
        const endTime = performance.now()
        const duration = endTime - startTime

        logBotPerformance(botId, {
          operation,
          duration: `${duration.toFixed(2)}ms`,
        })

        return duration
      },
    }
  }

  // Memory usage tracking
  const trackMemoryUsage = (botId: number) => {
    // Type assertion for performance.memory (Chrome-specific API)
    const performanceWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
    }

    if (typeof performance !== 'undefined' && performanceWithMemory.memory) {
      const memory = performanceWithMemory.memory
      const logData = {
        botId,
        timestamp: new Date().toISOString(),
        memory: {
          used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
        },
      }

      console.log(`[Bot Memory] Bot ${botId}:`, logData)

      if (devtools && typeof devtools.log === 'function') {
        devtools.log(`Bot Memory: ${botId}`, logData)
      }
    }
  }

  return {
    logBotAction,
    logBotPerformance,
    logBotError,
    trackBotStateChange,
    debugBotConfig,
    startPerformanceTimer,
    trackMemoryUsage,
  }
}
