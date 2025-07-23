export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side - let client handle auth
  if (process.server) {
    return
  }
  
  const { isAuthenticated, isAdmin, initializeAuth } = useAuth()
  
  // First try to initialize auth state from localStorage
  await initializeAuth()
  
  // Check if user is authenticated
  if (!isAuthenticated.value) {
    // Not authenticated, redirect to login
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  
  // Check if user has admin role
  if (!isAdmin.value) {
    // User is authenticated but not admin, redirect to dashboard
    return navigateTo('/dashboard')
  }
}) 