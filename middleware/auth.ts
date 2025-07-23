export default defineNuxtRouteMiddleware((to, from) => {
  // Only run on client side
  if (process.client) {
    const authStore = useAuthStore()
    
    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      // Redirect to login page
      return navigateTo('/login')
    }
  }
}) 