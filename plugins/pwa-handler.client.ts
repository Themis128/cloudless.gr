/**
 * Service Worker error handler plugin
 * Handles PWA-related errors gracefully in development and production
 */
export default defineNuxtPlugin(() => {
  // Only run on client side
  if (process.client) {
    // Handle service worker registration errors
    if ('serviceWorker' in navigator) {
      // Listen for service worker errors
      navigator.serviceWorker.addEventListener('error', (event) => {
        console.warn('Service Worker error:', event)
        // Don't throw in development to prevent app crashes
        if (process.env.NODE_ENV === 'development') {
          event.preventDefault()
        }
      })

      // Handle service worker registration failures
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        if (process.env.NODE_ENV === 'development') {
          console.info('Service Worker registration skipped in development:', error.message)
        } else {
          console.error('Service Worker registration failed:', error)
        }
      })

      // Handle service worker update events
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (process.env.NODE_ENV === 'production') {
          console.log('Service Worker updated')
          // Could show a notification to user about app update
        }
      })
    } else {
      console.info('Service Worker not supported in this browser')
    }

    // Handle PWA install prompt
    let deferredPrompt: any = null

    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later
      deferredPrompt = e
      console.log('PWA install prompt available')
    })

    // Provide global PWA utilities
    const pwaUtils = {
      canInstall: () => !!deferredPrompt,
      promptInstall: async () => {
        if (!deferredPrompt) {
          return { success: false, error: 'Install prompt not available' }
        }

        try {
          deferredPrompt.prompt()
          const { outcome } = await deferredPrompt.userChoice
          deferredPrompt = null
          
          return {
            success: true,
            outcome,
            message: outcome === 'accepted' ? 'App installed successfully' : 'Install cancelled'
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Install failed'
          }
        }
      }
    }

    // Make PWA utilities available globally
    const nuxtApp = useNuxtApp()
    nuxtApp.provide('pwa', pwaUtils)

    // Handle app installed event
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully')
      deferredPrompt = null
    })

    // Enhanced error handling for webview and PWA issues
    window.addEventListener('error', (event) => {
      const error = event.error || event.message

      // Handle specific PWA/Service Worker errors
      if (
        error && 
        typeof error === 'string' && 
        (error.includes('service worker') || 
         error.includes('ServiceWorker') ||
         error.includes('InvalidStateError'))
      ) {
        console.warn('PWA error handled gracefully:', error)
        
        // Prevent the error from breaking the app
        event.preventDefault()
        
        // In development, provide helpful message
        if (process.env.NODE_ENV === 'development') {
          console.info('💡 PWA features are disabled in development mode to prevent errors')
        }
        
        return false
      }
    })

    // Handle unhandled promise rejections related to PWA
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason

      if (
        reason && 
        typeof reason === 'object' && 
        (reason.message?.includes('service worker') || 
         reason.message?.includes('ServiceWorker') ||
         reason.message?.includes('InvalidStateError'))
      ) {
        console.warn('PWA promise rejection handled gracefully:', reason)
        
        // Prevent the error from being thrown
        event.preventDefault()
        
        if (process.env.NODE_ENV === 'development') {
          console.info('💡 PWA-related promise rejection prevented in development')
        }
        
        return false
      }
    })
  }
})
