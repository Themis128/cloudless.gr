/**
 * Secure redirect utility functions
 * Provides centralized redirect validation and sanitization
 */

/**
 * List of allowed redirect paths for security
 * All redirects must start with one of these paths
 */
const ALLOWED_REDIRECT_PATHS = [
  '/dashboard',
  '/admin',
  '/settings', 
  '/profile',
  '/projects',
  '/contact',
  '/about',
  '/user',
  '/workspace',
  '/billing',
  '/team',
  '/'
] as const

/**
 * Default redirect paths based on user role
 */
const DEFAULT_REDIRECTS = {
  admin: '/admin/dashboard',
  user: '/dashboard',
  default: '/dashboard'
} as const

/**
 * Sanitize and validate a redirect URL to prevent open redirect attacks
 * @param redirectUrl - The redirect URL to validate
 * @param userRole - Optional user role for role-based defaults
 * @returns A safe redirect path or default fallback
 */
export function sanitizeRedirect(redirectUrl: string | null | undefined, userRole?: string): string {
  // Return role-based default if no redirect provided
  if (!redirectUrl) {
    if (userRole === 'admin') return DEFAULT_REDIRECTS.admin
    if (userRole === 'user') return DEFAULT_REDIRECTS.user
    return DEFAULT_REDIRECTS.default
  }

  // Ensure it's a string and trim whitespace
  const cleanUrl = String(redirectUrl).trim()

  // Reject empty strings
  if (!cleanUrl) {
    return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
  }

  // Only allow relative paths that start with /
  if (!cleanUrl.startsWith('/')) {
    return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
  }

  // Prevent protocol-relative URLs (//example.com)
  if (cleanUrl.startsWith('//')) {
    return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
  }

  // Prevent JavaScript URLs
  if (cleanUrl.toLowerCase().includes('javascript:') || cleanUrl.toLowerCase().includes('data:')) {
    return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
  }

  // Check if the path starts with an allowed prefix
  const isAllowedPath = ALLOWED_REDIRECT_PATHS.some(allowedPath => 
    cleanUrl.startsWith(allowedPath)
  )

  if (!isAllowedPath) {
    console.warn(`Rejected redirect to unauthorized path: ${cleanUrl}`)
    return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
  }

  // Additional security: decode and re-validate after URL decoding
  try {
    const decodedUrl = decodeURIComponent(cleanUrl)
    
    // Re-check after decoding
    if (!decodedUrl.startsWith('/') || decodedUrl.startsWith('//')) {
      return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
    }    // Check for encoded malicious patterns
    if (decodedUrl.toLowerCase().includes('javascript:') || decodedUrl.toLowerCase().includes('data:')) {
      return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
    }
    
    return decodedUrl
  } catch {
    // If decoding fails, return safe default
    console.warn(`Failed to decode redirect URL: ${cleanUrl}`)
    return userRole === 'admin' ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.default
  }
}

/**
 * Extract redirect parameter from route query with fallback options
 * Supports both 'redirect' and 'redirectTo' query parameters
 * @param route - The current route object
 * @param userRole - Optional user role for role-based defaults
 * @returns Sanitized redirect path
 */
export function getRedirectFromQuery(route: any, userRole?: string): string {
  const redirectParam = route.query?.redirect || route.query?.redirectTo
  return sanitizeRedirect(redirectParam as string, userRole)
}

/**
 * Create a login URL with a redirect parameter
 * @param currentPath - The current path to redirect back to after login
 * @param loginPath - The login page path (defaults to /auth/login)
 * @returns Complete login URL with redirect parameter
 */
export function createLoginRedirectUrl(currentPath: string, loginPath: string = '/auth/login'): string {
  const sanitizedPath = sanitizeRedirect(currentPath)
  return `${loginPath}?redirect=${encodeURIComponent(sanitizedPath)}`
}

/**
 * Check if a redirect path is allowed
 * @param path - The path to check
 * @returns true if the path is allowed, false otherwise
 */
export function isAllowedRedirectPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false
  
  const cleanPath = path.trim()
  if (!cleanPath.startsWith('/') || cleanPath.startsWith('//')) return false
  
  return ALLOWED_REDIRECT_PATHS.some(allowedPath => 
    cleanPath.startsWith(allowedPath)
  )
}

/**
 * Get callback URL for OAuth providers with secure redirect
 * @param redirectParam - The redirect parameter to include
 * @param provider - The OAuth provider name
 * @param baseUrl - The base URL for the callback
 * @returns Complete callback URL with secure redirect
 */
export function getOAuthCallbackUrl(
  redirectParam: string | null | undefined, 
  provider: string, 
  baseUrl: string = window.location.origin
): string {
  const sanitizedRedirect = sanitizeRedirect(redirectParam)
  return `${baseUrl}/auth/callback?type=oauth&provider=${provider}&redirect=${encodeURIComponent(sanitizedRedirect)}`
}

/**
 * Get magic link callback URL with secure redirect
 * @param redirectParam - The redirect parameter to include
 * @param baseUrl - The base URL for the callback
 * @returns Complete callback URL with secure redirect
 */
export function getMagicLinkCallbackUrl(
  redirectParam: string | null | undefined,
  baseUrl: string = window.location.origin
): string {
  const sanitizedRedirect = sanitizeRedirect(redirectParam)
  return `${baseUrl}/auth/callback?type=magiclink&redirect=${encodeURIComponent(sanitizedRedirect)}`
}
