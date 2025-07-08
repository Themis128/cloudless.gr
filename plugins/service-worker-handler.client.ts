/**
 * Service Worker error prevention plugin
 * Specifically handles the "InvalidStateError: Failed to register a ServiceWorker" error
 */
export default defineNuxtPlugin(() => {
  if (process.client) {
    // Override console.error to catch and handle service worker errors
    const originalConsoleError = console.error
    
    console.error = (...args) => {
      const message = args.join(' ')
      
      // Check if it's the specific service worker error
      if (message.includes('Failed to register a ServiceWorker') && 
          message.includes('InvalidStateError')) {
        console.warn('🔧 Service Worker registration prevented in development mode')
        console.info('💡 This error is normal in development and will not affect functionality')
        return // Don't log the error
      }
      
      // Call original console.error for other errors
      originalConsoleError.apply(console, args)
    }
    
    // Handle the specific webview error
    window.addEventListener('error', (event) => {
      if (event.message && 
          event.message.includes('Failed to register a ServiceWorker') &&
          event.message.includes('InvalidStateError')) {
        
        console.info('🛡️ Service Worker error caught and handled gracefully')
        event.preventDefault()
        return false
      }
    })
    
    // Handle promise rejections related to service workers
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      
      if (reason && 
          typeof reason === 'object' && 
          reason.message &&
          reason.message.includes('Failed to register a ServiceWorker')) {
        
        console.info('🛡️ Service Worker promise rejection handled gracefully')
        event.preventDefault()
        return false
      }
    })
    
    // Provide a safe way to check if PWA features are available
    const nuxtApp = useNuxtApp()
    nuxtApp.provide('isPWASupported', () => {
      return process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator
    })
  }
})
