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
  // Skip middleware on server side in SPA mode
  if (process.server) return
  
  const normalizedPath = withoutTrailingSlash(to.path || '/')
  
  console.log('[AUTH] Checking route:', normalizedPath)

  // If the requested path is a public route, allow access without authentication
  if (publicRoutes.includes(normalizedPath)) {
    console.log('[AUTH] Public route, allowing access')
    return // Public access allowed
  }

  // Check if this is an admin route
  const isAdminRoute = adminRoutes.some(route => normalizedPath.startsWith(route))
  console.log('[AUTH] Is admin route:', isAdminRoute)

  // Check authentication status
  try {
    const supabase = useSupabaseClient()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    console.log('[AUTH] Session check result:', { 
      hasSession: !!sessionData.session, 
      hasUser: !!sessionData.session?.user,
      error: sessionError 
    })
    
    // Handle case where there's no session or there's an error
    if (sessionError || !sessionData.session?.user) {
      // Redirect to appropriate auth page based on route type
      const redirectUrl = isAdminRoute ? '/auth/admin-login' : `/auth?redirect=${encodeURIComponent(to.fullPath)}`
      console.log('[AUTH] No valid session, redirecting to:', redirectUrl)
      return navigateTo(redirectUrl)
    }

    console.log('[AUTH] Valid session found, allowing access')
    
    // If this is an admin route, verify admin role
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
