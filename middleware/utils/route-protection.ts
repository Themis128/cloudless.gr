// Unified route protection utilities
export const publicRoutes = [
  '/',
  '/about', 
  '/contact',
  '/docs',
  '/auth/login',
  '/auth/signup',
  '/auth/admin-login',
  '/auth/callback'
]

export const adminRoutes = [
  '/admin'
]

export const protectedRoutes = [
  '/dashboard',
  '/agents', 
  '/deploy',
  '/builder',
  '/workflows',
  '/settings',
  '/logs',
  '/memory',
  '/orchestrator'
]

export const requiresAuth = (path: string): boolean => {
  // Check if route requires authentication
  return !publicRoutes.some(route => path === route || path.startsWith(route + '/'))
}

export const requiresAdmin = (path: string): boolean => {
  // Check if route requires admin access
  return adminRoutes.some(route => path === route || path.startsWith(route + '/'))
}

export const isPublicRoute = (path: string): boolean => {
  return publicRoutes.some(route => path === route || path.startsWith(route + '/'))
}

export const isStaticAsset = (path: string): boolean => {
  return path.startsWith('/_nuxt/') || 
         path.startsWith('/api/') || 
         path.includes('.') ||
         path.startsWith('/__nuxt_error')
}
