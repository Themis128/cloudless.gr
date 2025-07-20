// Server-side timer conflict prevention middleware
import { defineEventHandler, setResponseHeaders } from 'h3'

export default defineEventHandler((event) => {
  // Set headers to disable performance monitoring on the server side
  setResponseHeaders(event, {
    'X-Performance-Monitoring': 'disabled',
    'X-Timer-Conflicts': 'suppressed'
  })
  
  // Add server-side console overrides if possible
  if (process.env.NODE_ENV === 'development') {
    // Override console methods on server side to suppress timer warnings
    const originalWarn = console.warn
    const originalError = console.error
    
    console.warn = (...args) => {
      const message = args[0]
      if (typeof message === 'string' && (
        message.includes('Timer') && message.includes('already exists') ||
        message.includes('[nuxt-app]') && message.includes('already exists') ||
        message.includes('No such label') && message.includes('console.timeEnd') ||
        message.includes('Label') && message.includes('already exists for console.time')
      )) {
        return // Suppress timer conflict warnings
      }
      originalWarn.apply(console, args)
    }
    
    console.error = (...args) => {
      const message = args[0]
      if (typeof message === 'string' && (
        message.includes('Timer') && message.includes('already exists') ||
        message.includes('[nuxt-app]') && message.includes('already exists') ||
        message.includes('No such label') && message.includes('console.timeEnd') ||
        message.includes('Label') && message.includes('already exists for console.time')
      )) {
        return // Suppress timer conflict warnings
      }
      originalError.apply(console, args)
    }
  }
}) 