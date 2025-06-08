/**
 * Auth Middleware
 * Ensures user is authenticated before accessing protected routes
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Only run on client side
  if (process.server) return

  const user = useSupabaseUser()
  const supabase = useSupabaseClient()

  // Check if user is authenticated
  if (!user.value) {
    try {
      // Try to get current session to ensure we have the latest auth state
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Auth middleware session check failed:', error)
      }
      
      // If still no user after session check, redirect to login
      if (!session?.user) {
        console.log('No authenticated user found, redirecting to login')
        // Store the intended destination and redirect to login
        const loginUrl = `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`
        return navigateTo(loginUrl)
      }
    } catch (error) {
      console.error('Auth middleware error:', error)
      // On any auth error, redirect to login
      const loginUrl = `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`
      return navigateTo(loginUrl)
    }
  }
})
