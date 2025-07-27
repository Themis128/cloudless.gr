export default defineNuxtRouteMiddleware(async (to: any) => {
  // Only run on client side
  if (process.client) {
    // Get auth state from store
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
      // Redirect to login page with redirect parameter
      return navigateTo(
        `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`
      )
    }

    // Check if user is admin
    if (!authStore.isAdmin) {
      // Redirect to dashboard if not admin
      return navigateTo('/dashboard')
    }
  }
})
