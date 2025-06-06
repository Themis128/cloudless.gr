// Enhanced route protection utilities with Vuetify and Nuxt 3 optimizations
export const publicRoutes = [
  '/',
  '/about', 
  '/contact',
  '/docs',
  '/auth/login',
  '/auth/signup',
  '/auth/admin-login',
  '/auth/callback',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/admin-warning',
  '/forbidden'
]

export const adminRoutes = [
  '/admin',
  '/admin/',
  '/admin/dashboard',
  '/admin/contact-submissions',
  '/admin/settings',
  '/admin/users'
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
  '/orchestrator',
  '/profile'
]

// Routes that require any form of authentication (user or admin)
export const authRequiredRoutes = [
  ...protectedRoutes,
  ...adminRoutes
]

export const requiresAuth = (path: string): boolean => {
  // Check if route requires authentication (user or admin)
  return authRequiredRoutes.some(route => path === route || path.startsWith(route + '/'))
}

export const requiresAdmin = (path: string): boolean => {
  // Check if route requires admin access specifically
  if (path.startsWith('/admin')) {
    return true
  }
  return adminRoutes.some(route => path === route)
}

export const isPublicRoute = (path: string): boolean => {
  // Check if route is completely public (no auth needed)
  return publicRoutes.some(route => path === route || path.startsWith(route + '/'))
}

export const isStaticAsset = (path: string): boolean => {
  // Check for static assets, API routes, and Nuxt internals
  return path.startsWith('/_nuxt/') || 
         path.startsWith('/api/') || 
         path.startsWith('/__nuxt_error') ||
         path.startsWith('/_vite/') ||
         path.includes('.') ||
         path.startsWith('/favicon') ||
         path.startsWith('/robots.txt') ||
         path.startsWith('/sitemap')
}

// Utility for determining redirect destination after login
export const getPostLoginRedirect = (userRole: 'admin' | 'user', intendedPath?: string): string => {
  // If there's an intended path and it's accessible, go there
  if (intendedPath && intendedPath !== '/' && !intendedPath.startsWith('/auth/')) {
    if (userRole === 'admin' || !requiresAdmin(intendedPath)) {
      return intendedPath
    }
  }
  
  // Default redirects based on role
  return userRole === 'admin' ? '/admin/dashboard' : '/dashboard'
}

// Helper for Vuetify theme and user preferences
export const shouldLoadUserPreferences = (path: string): boolean => {
  // Load user preferences for authenticated routes
  return requiresAuth(path) && !isStaticAsset(path)
}
