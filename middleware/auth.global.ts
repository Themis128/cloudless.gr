import { withoutTrailingSlash } from 'ufo'

// Define public routes that do **not** require authentication
const publicRoutes = [
  '/',
  '/info',
  '/info/matrix',
  '/info/about',
  '/info/contact',
  '/info/faq',
  '/info/sitemap',
  '/auth',
  '/auth/register',
  '/auth/reset',
  '/auth/admin-login',
  '/auth/users-nav',
]

// Admin routes that require admin role
const adminRoutes = ['/admin']

export default defineNuxtRouteMiddleware(async (to) => {
  const normalizedPath = withoutTrailingSlash(to.path || '/')

  // If the requested path is a public route, allow access without authentication
  if (publicRoutes.includes(normalizedPath)) {
    return // Public access allowed
  }

  // Check if this is an admin route
  const isAdminRoute = adminRoutes.some(route => normalizedPath.startsWith(route))

  // Check authentication status
  try {
    const supabase = useSupabaseClient()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    // Handle case where there's no session or there's an error
    if (sessionError || !sessionData.session?.user) {
      // Redirect to appropriate auth page based on route type
      const redirectUrl = isAdminRoute ? '/auth/admin-login' : `/auth?redirect=${encodeURIComponent(to.fullPath)}`
      return navigateTo(redirectUrl)
    }    // If this is an admin route, verify admin role
    if (isAdminRoute) {
      const userId = sessionData.session.user.id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profileError || !profile || (profile as any).role !== 'admin') {
        console.warn('[AUTH] Admin access denied:', profileError || 'User is not admin')
        return navigateTo('/auth/admin-login?error=unauthorized')
      }
    }

  } catch (err) {
    console.error(`[AUTH] Error during session check:`, err)
    const redirectUrl = isAdminRoute ? '/auth/admin-login' : `/auth?redirect=${encodeURIComponent(to.fullPath)}`
    return navigateTo(redirectUrl)
  }
})
