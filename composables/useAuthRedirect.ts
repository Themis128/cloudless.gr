import { 
  getRedirectFromQuery, 
  createLoginRedirectUrl, 
  isAllowedRedirectPath as checkAllowedPath,
  getOAuthCallbackUrl,
  getMagicLinkCallbackUrl 
} from '~/utils/secureRedirect'

/**
 * Composable for handling authentication redirects
 * Provides secure redirect functionality with validation
 */
export const useAuthRedirect = () => {
  const route = useRoute()
  const router = useRouter()
  
  /**
   * Get a validated redirect path from query parameters
   * Supports both 'redirect' and 'redirectTo' query params
   */
  const getRedirectPath = (userRole?: string): string => {
    return getRedirectFromQuery(route, userRole)
  }

  /**
   * Redirect after successful login with optional role-based logic
   */
  const redirectAfterLogin = async (userRole?: string) => {
    const redirectPath = getRedirectPath(userRole)
    
    try {
      await router.push(redirectPath)
    } catch (redirectError) {
      console.warn('Redirect failed, falling back to dashboard:', redirectError)
      const fallback = userRole === 'admin' ? '/admin/dashboard' : '/dashboard'
      await router.push(fallback)
    }
  }

  /**
   * Redirect to login with current path as redirect parameter
   */
  const redirectToLogin = (currentPath?: string) => {
    const path = currentPath || route.fullPath
    const loginUrl = createLoginRedirectUrl(path)
    return navigateTo(loginUrl)
  }

  /**
   * Check if a path is allowed for redirects
   */
  const isAllowedRedirectPath = (path: string): boolean => {
    return checkAllowedPath(path)
  }

  /**
   * Create OAuth callback URL with secure redirect
   */
  const getOAuthRedirectUrl = (provider: string): string => {
    const redirectParam = route.query.redirect || route.query.redirectTo
    return getOAuthCallbackUrl(redirectParam as string, provider)
  }

  /**
   * Create magic link callback URL with secure redirect
   */
  const getMagicLinkRedirectUrl = (): string => {
    const redirectParam = route.query.redirect || route.query.redirectTo
    return getMagicLinkCallbackUrl(redirectParam as string)
  }

  return {
    getRedirectPath,
    redirectAfterLogin,
    redirectToLogin,
    isAllowedRedirectPath,
    getOAuthRedirectUrl,
    getMagicLinkRedirectUrl
  }
}
