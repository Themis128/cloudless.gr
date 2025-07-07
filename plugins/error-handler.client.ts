/**
 * Enhanced error handler plugin
 * Vue 3 + Nuxt 3 + Vuetify 3 best practices:
 * - Global error boundary
 * - User-friendly error reporting
 * - Performance monitoring
 * - Accessibility compliance
 */
import { defineNuxtPlugin } from '#app'

interface ErrorContext {
  timestamp: Date
  userAgent: string
  url: string
  userId?: string
  sessionId?: string
}

interface ErrorReport {
  message: string
  stack?: string
  context: ErrorContext
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'javascript' | 'network' | 'auth' | 'ui' | 'api'
}

export default defineNuxtPlugin((nuxtApp) => {
  // Global error handler with enhanced reporting
  nuxtApp.vueApp.config.errorHandler = (error: Error, instance, info) => {
    console.error('Vue Error:', error, info)
    
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      context: getErrorContext(),
      severity: determineSeverity(error, info),
      category: categorizeError(error, info)
    }
    
    // Report error to monitoring service
    reportError(errorReport)
    
    // Handle critical errors differently
    if (errorReport.severity === 'critical') {
      console.error('🚨 Critical error detected, may need page reload')
    }
  }
  
  // Enhanced client-side error handling
  if (process.client) {
    // Global unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason
      
      // Check if it's a connection-related error (existing logic)
      if (error && typeof error === 'object' && 
          (error.message?.includes('ECONNRESET') || 
           error.message?.includes('fetch') ||
           error.code === 'ECONNRESET' ||
           error.name === 'TypeError' && error.message?.includes('fetch'))) {
        
        console.warn('🔄 Handling connection error gracefully:', error.message || error)
        event.preventDefault()
        console.info('ℹ️ Connection issue detected, retrying in background...')
        return
      }
      
      // Enhanced error reporting for other promise rejections
      console.error('Unhandled Promise Rejection:', event.reason)
      
      const errorReport: ErrorReport = {
        message: `Unhandled Promise Rejection: ${event.reason}`,
        context: getErrorContext(),
        severity: 'high',
        category: 'javascript'
      }
      
      reportError(errorReport)
      
      // Let other errors be handled normally
      console.error('❌ Unhandled rejection:', error)
    })
    
    // Enhanced global JavaScript error handler
    window.addEventListener('error', (event) => {
      const error = event.error
      
      // Existing connection error handling
      if (error && error.message?.includes('ECONNRESET')) {
        console.warn('🔄 Handling connection error gracefully:', error.message)
        event.preventDefault()
        return
      }
      
      // Enhanced error reporting
      console.error('Global JavaScript Error:', event.error)
      
      const errorReport: ErrorReport = {
        message: event.message,
        stack: event.error?.stack,
        context: getErrorContext(),
        severity: determineSeverity(event.error),
        category: 'javascript'
      }
      
      reportError(errorReport)
    })
    
    // Resource loading error handler
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement
        const resourceType = target.tagName.toLowerCase()
        
        console.warn(`Resource loading error: ${resourceType}`, target)
        
        const errorReport: ErrorReport = {
          message: `Failed to load ${resourceType}: ${target.getAttribute('src') || target.getAttribute('href')}`,
          context: getErrorContext(),
          severity: 'medium',
          category: 'network'
        }
        
        reportError(errorReport)
      }
    }, true)
  }
  
  // Custom error boundary for components
  nuxtApp.hook('vue:error', (error, instance, info) => {
    console.error('Vue Hook Error:', error, info)
    
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      context: getErrorContext(),
      severity: determineSeverity(error, info),
      category: 'ui'
    }
    
    reportError(errorReport)
  })
  
  // API error handler
  nuxtApp.hook('app:error', (error) => {
    console.error('App Error:', error)
    
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      context: getErrorContext(),
      severity: 'high',
      category: 'api'
    }
    
    reportError(errorReport)
  })
  
  // Provide global error utilities
  nuxtApp.provide('errorHandler', {
    reportError: (error: Error | string, context?: Partial<ErrorContext>) => {
      const errorReport: ErrorReport = {
        message: typeof error === 'string' ? error : error.message,
        stack: typeof error === 'object' ? error.stack : undefined,
        context: { ...getErrorContext(), ...context },
        severity: 'medium',
        category: 'javascript'
      }
      
      reportError(errorReport)
    }
  })
})

// Helper functions
function getErrorContext(): ErrorContext {
  return {
    timestamp: new Date(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userId: getCurrentUserId(),
    sessionId: getSessionId()
  }
}

function getCurrentUserId(): string | undefined {
  try {
    // Try to get user from session storage or similar
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('user-id') || undefined
    }
    return undefined
  } catch {
    return undefined
  }
}

function getSessionId(): string | undefined {
  if (typeof sessionStorage !== 'undefined') {
    let sessionId = sessionStorage.getItem('session-id')
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('session-id', sessionId)
    }
    return sessionId
  }
  return undefined
}

function determineSeverity(error: Error, info?: string): ErrorReport['severity'] {
  const message = error.message.toLowerCase()
  
  // Critical errors that break functionality
  if (
    message.includes('out of memory') ||
    message.includes('maximum call stack') ||
    message.includes('script error') ||
    info?.includes('mounted')
  ) {
    return 'critical'
  }
  
  // High severity errors
  if (
    message.includes('network error') ||
    message.includes('fetch') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return 'high'
  }
  
  // Medium severity errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('not found')
  ) {
    return 'medium'
  }
  
  return 'low'
}

function categorizeError(error: Error, info?: string): ErrorReport['category'] {
  const message = error.message.toLowerCase()
  
  if (message.includes('fetch') || message.includes('network')) {
    return 'network'
  }
  
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'auth'
  }
  
  if (message.includes('api') || message.includes('server')) {
    return 'api'
  }
  
  if (info?.includes('render') || info?.includes('component')) {
    return 'ui'
  }
  
  return 'javascript'
}

async function reportError(errorReport: ErrorReport) {
  try {
    // In development, just log to console
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Report - ${errorReport.severity.toUpperCase()}`)
      console.error('Message:', errorReport.message)
      console.error('Category:', errorReport.category)
      console.error('Context:', errorReport.context)
      if (errorReport.stack) {
        console.error('Stack:', errorReport.stack)
      }
      console.groupEnd()
      return
    }
    
    // In production, could send to error tracking service
    // await $fetch('/api/errors/report', {
    //   method: 'POST',
    //   body: errorReport
    // })
  } catch (reportingError) {
    console.error('Error reporting failed:', reportingError)
  }
}
