export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side - let client handle auth
  if (process.server) {
    return
  }
  
  const { isAuthenticated, initializeAuth } = useAuth()
  
  // Skip middleware on auth pages
  if (to.path.startsWith('/auth/')) {
    return
  }
  
  // Skip middleware on public pages
  const publicPages = ['/', '/about', '/documentation']
  if (publicPages.includes(to.path)) {
    return
  }
  
  // First try to initialize auth state from localStorage
  await initializeAuth()
  
  // For protected pages, check authentication
  if (!isAuthenticated.value) {
    // Not authenticated, redirect to login
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
}) 