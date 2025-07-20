import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  // Completely disable performance monitoring timers to prevent conflicts
  if (process.client) {
    // Store original console methods
    // eslint-disable-next-line no-console
    const originalWarn = console.warn
    // eslint-disable-next-line no-console
    const originalError = console.error
    // eslint-disable-next-line no-console
    const originalTime = console.time
    // eslint-disable-next-line no-console
    const originalTimeEnd = console.timeEnd
    
    // Track active timers to prevent duplicates
    const activeTimers = new Set<string>()
    
    // Completely override console.time to prevent any timer warnings
    // eslint-disable-next-line no-console
    console.time = (label: string) => {
      // For Nuxt-specific timers, completely ignore them to prevent warnings
      if (label.startsWith('[nuxt-app]')) {
        // Don't create Nuxt timers at all to avoid conflicts
        return
      }
      
      // Silently ignore if timer already exists
      if (activeTimers.has(label)) {
        return
      }
      
      // Add to active timers first
      activeTimers.add(label)
      
      // Try to create the timer, but don't let it throw warnings
      try {
        originalTime.call(console, label)
      } catch (e) {
        // If timer creation fails, remove from active timers
        activeTimers.delete(label)
      }
    }
    
    // Override console.timeEnd to safely end timers
    // eslint-disable-next-line no-console
    console.timeEnd = (label: string) => {
      // For Nuxt-specific timers, completely ignore them
      if (label.startsWith('[nuxt-app]')) {
        return
      }
      
      if (activeTimers.has(label)) {
        activeTimers.delete(label)
        try {
          originalTimeEnd.call(console, label)
        } catch (e) {
          // Silently ignore timeEnd errors
        }
      }
    }
    
    // Completely suppress all timer-related warnings and errors
    // eslint-disable-next-line no-console
    console.warn = (...args) => {
      const message = args[0]
      if (typeof message === 'string' && (
        message.includes('Timer') && message.includes('already exists') ||
        message.includes('[nuxt-app]') && message.includes('already exists') ||
        message.includes('No such label') && message.includes('console.timeEnd') ||
        message.includes('Label') && message.includes('already exists for console.time') ||
        message.includes('disable-performance.client.ts') && message.includes('Timer') ||
        message.includes('Timer') && message.includes('already exists') ||
        message.includes('console.time') && message.includes('already exists')
      )) {
        return // Completely suppress timer conflict warnings
      }
      originalWarn.apply(console, args)
    }
    
    // eslint-disable-next-line no-console
    console.error = (...args) => {
      const message = args[0]
      if (typeof message === 'string' && (
        message.includes('Timer') && message.includes('already exists') ||
        message.includes('[nuxt-app]') && message.includes('already exists') ||
        message.includes('No such label') && message.includes('console.timeEnd') ||
        message.includes('Label') && message.includes('already exists for console.time') ||
        message.includes('disable-performance.client.ts') && message.includes('Timer') ||
        message.includes('Timer') && message.includes('already exists') ||
        message.includes('console.time') && message.includes('already exists')
      )) {
        return // Completely suppress timer conflict warnings
      }
      originalError.apply(console, args)
    }

    // Disable performance monitoring if available
    if (typeof window !== 'undefined' && window.performance) {
      // Override performance.mark to prevent duplicate timer creation
      const originalMark = window.performance.mark
      window.performance.mark = function(name: string, options?: PerformanceMarkOptions) {
        try {
          // Clear existing mark before creating new one
          window.performance.clearMarks(name)
          return originalMark.call(this, name, options)
        } catch (e) {
          // If clearing fails, try to create the mark anyway
          try {
            return originalMark.call(this, name, options)
          } catch (e2) {
            // If all else fails, create a dummy mark to satisfy the return type
            return new PerformanceMark(name, options)
          }
        }
      }
      
      // Clear any existing performance marks on startup
      try {
        window.performance.clearMarks()
        window.performance.clearMeasures()
      } catch (e) {
        // Ignore errors if performance API is not fully supported
      }
    }
    
    // Suppress Nuxt timer warnings by overriding the timer creation
    if (nuxtApp.hook) {
      // Hook into page loading events to prevent duplicate timers
      nuxtApp.hook('page:loading:start', () => {
        // Clear any existing timers before starting new ones
        if (window.performance) {
          try {
            window.performance.clearMarks('[nuxt-app] page:loading:start')
            window.performance.clearMarks('[nuxt-app] page:loading:end')
            window.performance.clearMarks('[nuxt-app] link:prefetch')
            window.performance.clearMarks('[nuxt-app] app:created')
          } catch (e) {
            // Ignore errors
          }
        }
        // Clear console timers
        activeTimers.delete('[nuxt-app] page:loading:start')
        activeTimers.delete('[nuxt-app] page:loading:end')
        activeTimers.delete('[nuxt-app] link:prefetch')
        activeTimers.delete('[nuxt-app] app:created')
      })
      
      nuxtApp.hook('page:loading:end', () => {
        // Clear timers after page loading ends
        if (window.performance) {
          try {
            window.performance.clearMarks('[nuxt-app] page:loading:start')
            window.performance.clearMarks('[nuxt-app] page:loading:end')
          } catch (e) {
            // Ignore errors
          }
        }
        // Clear console timers
        activeTimers.delete('[nuxt-app] page:loading:start')
        activeTimers.delete('[nuxt-app] page:loading:end')
      })
      
      nuxtApp.hook('app:created', () => {
        // Clear app creation timers
        if (window.performance) {
          try {
            window.performance.clearMarks('[nuxt-app] app:created')
          } catch (e) {
            // Ignore errors
          }
        }
        activeTimers.delete('[nuxt-app] app:created')
      })
    }
    
    // Global timer suppression for any Nuxt-related timers
    const suppressNuxtTimers = () => {
      if (window.performance) {
        const nuxtTimerNames = [
          '[nuxt-app] page:loading:start',
          '[nuxt-app] page:loading:end', 
          '[nuxt-app] link:prefetch',
          '[nuxt-app] page:start',
          '[nuxt-app] page:finish',
          '[nuxt-app] app:created'
        ]
        
        nuxtTimerNames.forEach(name => {
          try {
            window.performance.clearMarks(name)
            activeTimers.delete(name)
          } catch (e) {
            // Ignore errors
          }
        })
      }
    }
    
    // Run timer suppression periodically
    setInterval(suppressNuxtTimers, 1000)
    
    // Also run on page visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', suppressNuxtTimers)
    }
    
    // Clear all timers on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        activeTimers.clear()
        if (window.performance) {
          try {
            window.performance.clearMarks()
            window.performance.clearMeasures()
          } catch (e) {
            // Ignore errors
          }
        }
      })
    }
  }
}) 