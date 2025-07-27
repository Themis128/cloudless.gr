import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface ErrorEntry {
  id: string
  message: string
  stack?: string
  context?: any
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  resolved: boolean
  retryCount: number
  maxRetries: number
  userAction?: string
  component?: string
  route?: string
}

interface ErrorHandler {
  id: string
  pattern: string | RegExp
  handler: (error: ErrorEntry) => void | Promise<void>
  priority: number
}

interface RecoveryStrategy {
  id: string
  category: string
  strategy: (error: ErrorEntry) => Promise<boolean>
  maxAttempts: number
}

export const useErrorHandlingStore = defineStore('errorHandling', () => {
  const errors = ref<ErrorEntry[]>([])
  const errorHandlers = ref<ErrorHandler[]>([])
  const recoveryStrategies = ref<RecoveryStrategy[]>([])
  const isRecovering = ref(false)

  // Add error with automatic categorization
  const addError = (
    error: Error | string,
    context?: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    category?: string
  ) => {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    // Auto-categorize based on error message
    const autoCategory = category || categorizeError(errorMessage)

    const errorEntry: ErrorEntry = {
      id: generateErrorId(),
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: Date.now(),
      severity,
      category: autoCategory,
      resolved: false,
      retryCount: 0,
      maxRetries: getMaxRetriesForCategory(autoCategory),
      component: context?.component,
      route: context?.route,
    }

    errors.value.push(errorEntry)

    // Execute error handlers
    executeErrorHandlers(errorEntry)

    // Attempt automatic recovery
    attemptRecovery(errorEntry)

    return errorEntry.id
  }

  // Categorize errors based on message patterns
  const categorizeError = (message: string): string => {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'network'
    }
    if (
      lowerMessage.includes('auth') ||
      lowerMessage.includes('unauthorized')
    ) {
      return 'authentication'
    }
    if (
      lowerMessage.includes('validation') ||
      lowerMessage.includes('invalid')
    ) {
      return 'validation'
    }
    if (lowerMessage.includes('database') || lowerMessage.includes('prisma')) {
      return 'database'
    }
    if (lowerMessage.includes('timeout')) {
      return 'timeout'
    }
    if (
      lowerMessage.includes('permission') ||
      lowerMessage.includes('forbidden')
    ) {
      return 'permission'
    }

    return 'general'
  }

  // Get max retries for error category
  const getMaxRetriesForCategory = (category: string): number => {
    const retryConfig: Record<string, number> = {
      network: 3,
      timeout: 2,
      database: 2,
      authentication: 1,
      validation: 0,
      permission: 0,
      general: 1,
    }

    return retryConfig[category] || 1
  }

  // Generate unique error ID
  const generateErrorId = (): string => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Register error handler
  const registerErrorHandler = (
    pattern: string | RegExp,
    handler: (error: ErrorEntry) => void | Promise<void>,
    priority: number = 0
  ) => {
    const handlerEntry: ErrorHandler = {
      id: `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern,
      handler,
      priority,
    }

    errorHandlers.value.push(handlerEntry)

    // Sort by priority (higher priority first)
    errorHandlers.value.sort((a, b) => b.priority - a.priority)
  }

  // Execute error handlers
  const executeErrorHandlers = async (error: ErrorEntry) => {
    for (const handler of errorHandlers.value) {
      const pattern = handler.pattern
      const matches =
        typeof pattern === 'string'
          ? error.message.includes(pattern)
          : pattern.test(error.message)

      if (matches) {
        try {
          await handler.handler(error)
        } catch (handlerError) {
          console.error('Error handler failed:', handlerError)
        }
      }
    }
  }

  // Register recovery strategy
  const registerRecoveryStrategy = (
    category: string,
    strategy: (error: ErrorEntry) => Promise<boolean>,
    maxAttempts: number = 3
  ) => {
    const recoveryEntry: RecoveryStrategy = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      strategy,
      maxAttempts,
    }

    recoveryStrategies.value.push(recoveryEntry)
  }

  // Attempt automatic recovery
  const attemptRecovery = async (error: ErrorEntry) => {
    if (error.retryCount >= error.maxRetries) {
      return false
    }

    const strategies = recoveryStrategies.value.filter(
      s => s.category === error.category
    )

    for (const strategy of strategies) {
      if (error.retryCount >= strategy.maxAttempts) {
        continue
      }

      try {
        isRecovering.value = true
        const success = await strategy.strategy(error)

        if (success) {
          resolveError(error.id, 'Automatic recovery successful')
          return true
        }
      } catch (recoveryError) {
        console.error('Recovery strategy failed:', recoveryError)
      } finally {
        isRecovering.value = false
      }
    }

    // Increment retry count
    error.retryCount++
    return false
  }

  // Resolve error
  const resolveError = (errorId: string, resolution?: string) => {
    const error = errors.value.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      error.userAction = resolution
    }
  }

  // Get errors by category
  const getErrorsByCategory = (category: string) => {
    return errors.value.filter(error => error.category === category)
  }

  // Get errors by severity
  const getErrorsBySeverity = (
    severity: 'low' | 'medium' | 'high' | 'critical'
  ) => {
    return errors.value.filter(error => error.severity === severity)
  }

  // Get unresolved errors
  const getUnresolvedErrors = computed(() => {
    return errors.value.filter(error => !error.resolved)
  })

  // Get critical errors
  const getCriticalErrors = computed(() => {
    return errors.value.filter(
      error => error.severity === 'critical' && !error.resolved
    )
  })

  // Get error statistics
  const getErrorStats = computed(() => {
    const total = errors.value.length
    const resolved = errors.value.filter(e => e.resolved).length
    const unresolved = total - resolved

    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}

    errors.value.forEach(error => {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1
    })

    return {
      total,
      resolved,
      unresolved,
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
      byCategory,
      bySeverity,
    }
  })

  // Clear resolved errors
  const clearResolvedErrors = () => {
    errors.value = errors.value.filter(error => !error.resolved)
  }

  // Clear all errors
  const clearAllErrors = () => {
    errors.value = []
  }

  // Export errors for debugging
  const exportErrors = () => {
    return {
      errors: errors.value,
      stats: getErrorStats.value,
      handlers: errorHandlers.value.length,
      recoveryStrategies: recoveryStrategies.value.length,
    }
  }

  // Retry specific error
  const retryError = async (errorId: string) => {
    const error = errors.value.find(e => e.id === errorId)
    if (error && !error.resolved) {
      return await attemptRecovery(error)
    }
    return false
  }

  // Batch retry errors
  const retryErrorsByCategory = async (category: string) => {
    const categoryErrors = getErrorsByCategory(category).filter(
      e => !e.resolved
    )
    const results = await Promise.all(
      categoryErrors.map(error => attemptRecovery(error))
    )

    return {
      total: categoryErrors.length,
      successful: results.filter(r => r).length,
      failed: results.filter(r => !r).length,
    }
  }

  return {
    // State
    errors,
    isRecovering,

    // Core operations
    addError,
    resolveError,
    retryError,

    // Registration
    registerErrorHandler,
    registerRecoveryStrategy,

    // Queries
    getErrorsByCategory,
    getErrorsBySeverity,
    getUnresolvedErrors,
    getCriticalErrors,
    getErrorStats,

    // Batch operations
    retryErrorsByCategory,
    clearResolvedErrors,
    clearAllErrors,

    // Utility
    exportErrors,
  }
})
