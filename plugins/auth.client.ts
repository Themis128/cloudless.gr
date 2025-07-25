<<<<<<< HEAD
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
=======
// Auth token plugin to add tokens to fetch requests
import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin((nuxtApp) => {
  // Add auth token to outgoing requests
  nuxtApp.hook('app:created', () => {
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function (resource, options) {
      // Skip interceptor for certain requests (like public assets)
      if (typeof resource === 'string' && 
          (resource.startsWith('/api/') || resource.includes('/api/'))) {
          
        // Get token from localStorage (our backup)
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          // Create headers if they don't exist
          options = options || {};
          options.headers = options.headers || {};
          
          // Add Authorization header with token
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
          };
        }
      }
      
      // Call original fetch with modified options
      return originalFetch.call(this, resource, options);
    };
  });
});
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
