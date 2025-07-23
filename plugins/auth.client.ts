export default defineNuxtPlugin(async () => {
  // Only run on client side
  if (process.server) return
  
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return
    
    const { initializeAuth } = useAuth()
    
    // Initialize auth state immediately on app startup
    if (initializeAuth && typeof initializeAuth === 'function') {
      initializeAuth()
      console.log('Auth plugin: Auth state initialized')
    } else {
      console.warn('Auth plugin: initializeAuth function not available')
    }
  } catch (error) {
    console.warn('Auth plugin: Failed to initialize auth state:', error)
    // Don't throw error, just log it - app should still work
  }
}) 