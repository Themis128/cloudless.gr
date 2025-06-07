/**
 * Auth Middleware
 * Ensures user is authenticated before accessing protected routes
 */
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  // Check if user is authenticated
  if (!user.value) {
    // Store the intended destination and redirect to login
    const loginUrl = `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`
    return navigateTo(loginUrl)
  }
})
