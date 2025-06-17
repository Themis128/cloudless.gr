/**
 * Page-level authentication guard for SPA mode
 * This runs on each protected page to ensure auth before rendering
 */

export const usePageAuth = (options: { 
  requireAuth?: boolean,
  requireAdmin?: boolean,
  redirectTo?: string 
} = {}) => {
  const { 
    requireAuth = true, 
    requireAdmin = false,
    redirectTo = '/auth'
  } = options
    const route = useRoute()
  const supabase = useSupabaseClient()
  
  const isAuthenticated = ref(false)
  const isAdmin = ref(false)
  const user = ref<any>(null)
  const loading = ref(true)
  const error = ref('')

  const checkAuth = async () => {
    try {
      loading.value = true
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('[PAGE_AUTH] Session error:', sessionError)
        error.value = sessionError.message
        return false
      }
      
      if (!session?.user) {
        console.log('[PAGE_AUTH] No session found')
        isAuthenticated.value = false
        return false
      }
      
      // Session exists
      isAuthenticated.value = true
      user.value = session.user
      
      // Check admin role if required
      if (requireAdmin) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          
        if (profileError || !profile || !(profile as any)?.role || (profile as any).role !== 'admin') {
          console.warn('[PAGE_AUTH] Admin access denied')
          isAdmin.value = false
          if (requireAdmin) return false
        } else {
          isAdmin.value = true
        }
      }
      
      return true
      
    } catch (err) {
      console.error('[PAGE_AUTH] Auth check failed:', err)
      error.value = 'Authentication check failed'
      return false
    } finally {
      loading.value = false
    }
  }
  
  const redirectToAuth = () => {
    const currentPath = route.fullPath
    const redirect = currentPath !== '/' ? `?redirect=${encodeURIComponent(currentPath)}` : ''
    const targetUrl = requireAdmin ? '/auth/admin-login' : `${redirectTo}${redirect}`
    
    console.log('[PAGE_AUTH] Redirecting to:', targetUrl)
    return navigateTo(targetUrl)
  }
  
  // Run auth check immediately
  const authPromise = checkAuth()
  
  // If auth is required and check fails, redirect
  if (requireAuth) {
    authPromise.then(authResult => {
      if (!authResult || (requireAdmin && !isAdmin.value)) {
        redirectToAuth()
      }
    })
  }
  
  return {
    isAuthenticated: readonly(isAuthenticated),
    isAdmin: readonly(isAdmin),
    user: readonly(user),
    loading: readonly(loading),
    error: readonly(error),
    checkAuth,
    redirectToAuth
  }
}
