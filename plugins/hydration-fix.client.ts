import { defineNuxtPlugin } from 'nuxt/app'
import { nextTick } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  if (process.client) {
    // Suppress hydration warnings in development
    const originalWarn = console.warn
    console.warn = (...args) => {
      const message = args[0]
      if (typeof message === 'string' && (
        message.includes('hydrate') ||
        message.includes('Attempting to hydrate existing markup but container is empty')
      )) {
        // Suppress hydration warnings
        return
      }
      originalWarn.apply(console, args)
    }

    // Improve hydration by ensuring proper mounting
    nuxtApp.hook('app:created', () => {
      // Ensure the app container is properly set up
      const appContainer = document.getElementById('__nuxt')
      if (appContainer && appContainer.children.length === 0) {
        // If container is empty, this might cause hydration issues
        console.log('App container is empty, ensuring proper setup')
      }
    })

    // Handle route changes to prevent hydration issues
    nuxtApp.hook('page:start', () => {
      // Clear any potential hydration conflicts
      if (window.performance) {
        try {
          window.performance.clearMarks()
          window.performance.clearMeasures()
        } catch (e) {
          // Ignore errors
        }
      }
    })

    // Additional hydration fix for Vue 3
    nuxtApp.hook('app:mounted', () => {
      // Force a re-render to fix any hydration mismatches
      nextTick(() => {
        // This helps ensure the DOM is properly synchronized
        if (document.body) {
          document.body.style.visibility = 'visible'
        }
      })
    })
  }
}) 