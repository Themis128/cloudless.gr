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
