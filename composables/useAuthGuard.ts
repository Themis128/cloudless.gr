import type { UserRole, RoleCheckResult, SessionData } from '~/types/auth'

/**
 * Enhanced auth guard composable with better error handling and type safety
 */
export const useAuthGuard = () => {
  const supabase = useSupabaseClient()

  /**
   * Check if current user has a specific role
   */
  const hasRole = async (requiredRole: UserRole): Promise<RoleCheckResult> => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !sessionData.session?.user) {
        return {
          hasRole: false,
          role: null,
          error: new Error('User not authenticated')
        }
      }

      const userId = sessionData.session.user.id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return {
          hasRole: false,
          role: null,
          error: new Error('Failed to fetch user role')
        }
      }

      const userRole = (profile as any).role as UserRole
      return {
        hasRole: userRole === requiredRole,
        role: userRole,
        error: undefined
      }
    } catch (error) {
      return {
        hasRole: false,
        role: null,
        error: error as Error
      }
    }
  }

  /**
   * Check if current user is an admin
   */
  const isAdmin = async (): Promise<boolean> => {
    const result = await hasRole('admin')
    return result.hasRole
  }

  /**
   * Check if current user is a regular user
   */
  const isUser = async (): Promise<boolean> => {
    const result = await hasRole('user')
    return result.hasRole
  }

  /**
   * Get current session data with validation
   */
  const getSessionData = async (): Promise<SessionData> => {
    try {
      const { data, error } = await supabase.auth.getSession()
      
      return {
        user: data.session?.user || null,
        session: data.session,
        isValid: !error && !!data.session?.user
      }    } catch (error) {
      console.error('[AUTH_GUARD] Session error:', error)
      return {
        user: null,
        session: null,
        isValid: false
      }
    }
  }

  /**
   * Require authentication with optional role check
   */
  const requireAuth = async (requiredRole?: UserRole): Promise<boolean> => {
    const sessionData = await getSessionData()
    
    if (!sessionData.isValid) {
      throw new Error('Authentication required')
    }

    if (requiredRole) {
      const roleCheck = await hasRole(requiredRole)
      if (!roleCheck.hasRole) {
        throw new Error(`${requiredRole} role required`)
      }
    }

    return true
  }

  /**
   * Check route access permissions
   */
  const canAccessRoute = async (routePath: string): Promise<boolean> => {
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

    const adminRoutes = ['/admin']

    // Public routes don't require authentication
    if (publicRoutes.includes(routePath)) {
      return true
    }

    // Check if this is an admin route
    const isAdminRoute = adminRoutes.some(route => routePath.startsWith(route))
    
    try {
      if (isAdminRoute) {
        await requireAuth('admin')
      } else {
        await requireAuth()
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Get appropriate redirect URL based on authentication state and route
   */
  const getRedirectUrl = async (targetPath: string): Promise<string> => {
    const sessionData = await getSessionData()
    
    if (!sessionData.isValid) {
      // User not authenticated
      const adminRoutes = ['/admin']
      const isAdminRoute = adminRoutes.some(route => targetPath.startsWith(route))
      
      if (isAdminRoute) {
        return '/auth/admin-login?error=login_required'
      } else {
        return `/auth?redirect=${encodeURIComponent(targetPath)}`
      }
    }

    // User is authenticated but may not have correct role
    const adminRoutes = ['/admin']
    const isAdminRoute = adminRoutes.some(route => targetPath.startsWith(route))
    
    if (isAdminRoute) {
      const roleCheck = await hasRole('admin')
      if (!roleCheck.hasRole) {
        return '/auth/admin-login?error=unauthorized'
      }
    }

    return targetPath
  }

  return {
    hasRole,
    isAdmin,
    isUser,
    getSessionData,
    requireAuth,
    canAccessRoute,
    getRedirectUrl
  }
}
