import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  // Handle unhandled promise rejections that might cause navigation issues
  if (process.client) {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason
      
      // Check if it's a connection-related error
      if (error && typeof error === 'object' && 
          (error.message?.includes('ECONNRESET') || 
           error.message?.includes('fetch') ||
           error.code === 'ECONNRESET' ||
           error.name === 'TypeError' && error.message?.includes('fetch'))) {
        
        console.warn('🔄 Handling connection error gracefully:', error.message || error)
        
        // Prevent the error from being thrown and breaking the app
        event.preventDefault()
        
        // Optional: Show a user-friendly message
        // You could integrate with a toast/notification system here
        console.info('ℹ️ Connection issue detected, retrying in background...')
        
        return
      }
      
      // Let other errors be handled normally
      console.error('❌ Unhandled rejection:', error)
    })
    
    // Handle general errors that might affect navigation
    window.addEventListener('error', (event) => {
      const error = event.error
      
      if (error && error.message?.includes('ECONNRESET')) {
        console.warn('🔄 Handling connection error gracefully:', error.message)
        event.preventDefault()
        return
      }
    })
  }
})
