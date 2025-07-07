import { defineStore } from 'pinia'
import { navigateTo } from '#app'
import { useAuthStore } from './authStore'
import { setRecentLogin, clearRecentLogin } from '~/utils/authFlags'

// Centralized URL configuration
const APP_CONFIG = {
  baseUrl: 'http://192.168.0.23:3000',
  defaultRedirect: '/users/index',
  authPath: '/auth',
  adminPath: '/admin'
}

// Navigation route configurations
interface NavigationRoute {
  path: string
  name: string
  requiresAuth: boolean
  requiresAdmin: boolean
  requiresVerification: boolean
  publicAccess: boolean
  redirectOnAuth?: string // Where to redirect if already authenticated
  layout?: string
}

// Helper functions for URL building
const buildAuthUrl = (redirectPath?: string): string => {
  const redirect = redirectPath || APP_CONFIG.defaultRedirect
  return `${APP_CONFIG.authPath}?redirect=${encodeURIComponent(redirect)}`
}

const buildUrl = (path: string): string => {
  return path // Return relative path for internal navigation
}

const buildFullUrl = (path: string): string => {
  return `${APP_CONFIG.baseUrl}${path}` // Full URL when actually needed
}

// Define all application routes with their requirements
const ROUTES: Record<string, NavigationRoute> = {
  // Public routes
  HOME: { path: '/', name: 'Home', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true, redirectOnAuth: '/users/index' },
  AUTH: { path: '/auth', name: 'Authentication', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  AUTH_LOGIN: { path: '/auth/login', name: 'Login', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true, redirectOnAuth: '/users/index' },
  AUTH_REGISTER: { path: '/auth/register', name: 'Register', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true, redirectOnAuth: '/users/index' },
  AUTH_RESET: { path: '/auth/reset', name: 'Reset Password', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  AUTH_CALLBACK: { path: '/auth/callback', name: 'Auth Callback', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  
  // Demo and development routes
  MCP_DEMO: { path: '/mcp-demo', name: 'MCP Demo', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  
  // Info pages
  INFO: { path: '/info', name: 'Information', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  INFO_ABOUT: { path: '/info/about', name: 'About', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  INFO_CONTACT: { path: '/info/contact', name: 'Contact', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  INFO_FAQ: { path: '/info/faq', name: 'FAQ', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  
  // Documentation
  DOCS: { path: '/documentation', name: 'Documentation', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  DOCS_API: { path: '/documentation/api-reference', name: 'API Reference', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  DOCS_GETTING_STARTED: { path: '/documentation/getting-started', name: 'Getting Started', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  DOCS_USER_GUIDE: { path: '/documentation/user-guide', name: 'User Guide', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  DOCS_TROUBLESHOOTING: { path: '/documentation/troubleshooting', name: 'Troubleshooting', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  
  // Legal
  LEGAL: { path: '/legal', name: 'Legal', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  LEGAL_PRIVACY: { path: '/legal/privacy', name: 'Privacy Policy', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  LEGAL_TERMS: { path: '/legal/terms', name: 'Terms of Service', requiresAuth: false, requiresAdmin: false, requiresVerification: false, publicAccess: true },
  
  // User dashboard (authenticated)
  USERS: { path: '/users', name: 'Dashboard', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_PROFILE: { path: '/users/profile', name: 'Profile', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_PROFILE_EDIT: { path: '/users/profile/edit', name: 'Edit Profile', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_SETTINGS: { path: '/users/settings', name: 'Settings', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_ACCOUNT: { path: '/users/account', name: 'Account', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_NOTIFICATIONS: { path: '/users/notifications', name: 'Notifications', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_ACTIVITY: { path: '/users/activity', name: 'Activity', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_PROJECTS: { path: '/users/projects', name: 'My Projects', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  USERS_CODEGEN: { path: '/users/codegen', name: 'Code Generator', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  
  // Projects (authenticated)
  PROJECTS: { path: '/projects', name: 'Projects', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'projects' },
  PROJECTS_CREATE: { path: '/projects/create', name: 'Create Project', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'projects' },
  
  // Storage (authenticated)
  STORAGE: { path: '/storage', name: 'Storage', requiresAuth: true, requiresAdmin: false, requiresVerification: false, publicAccess: false, layout: 'user' },
  
  // Admin routes (admin only)
  ADMIN: { path: '/admin', name: 'Admin Panel', requiresAuth: true, requiresAdmin: true, requiresVerification: false, publicAccess: false, layout: 'admin' },
  SYS_MAINTENANCE: { path: '/sys/maintenance', name: 'System Maintenance', requiresAuth: true, requiresAdmin: true, requiresVerification: false, publicAccess: false, layout: 'admin' },
}

interface NavigationState {
  currentRoute: string | null
  previousRoute: string | null
  pendingRedirect: string | null
  navigationHistory: string[]
  isNavigating: boolean
  error: string | null
}

export const useNavigationStore = defineStore('navigation', {
  state: (): NavigationState => ({
    currentRoute: null,
    previousRoute: null,
    pendingRedirect: null,
    navigationHistory: [],
    isNavigating: false,
    error: null,
  }),

  getters: {
    getCurrentRoute: (state) => state.currentRoute,
    getPreviousRoute: (state) => state.previousRoute,
    hasPendingRedirect: (state) => !!state.pendingRedirect,
    getNavigationHistory: (state) => state.navigationHistory,
    
    // Route helpers
    isCurrentRoute: (state) => (path: string) => state.currentRoute === path,
    isPublicRoute: () => (path: string) => {
      const route = Object.values(ROUTES).find(r => r.path === path)
      return route?.publicAccess ?? false
    },
    requiresAuth: () => (path: string) => {
      const route = Object.values(ROUTES).find(r => r.path === path)
      return route?.requiresAuth ?? true // Default to requiring auth for unknown routes
    },
    requiresAdmin: () => (path: string) => {
      const route = Object.values(ROUTES).find(r => r.path === path)
      return route?.requiresAdmin ?? false
    },
  },

  actions: {
    // Initialize navigation with current route
    initialize(currentPath: string) {
      this.currentRoute = currentPath
      this.addToHistory(currentPath)
    },

    // Add route to history
    addToHistory(path: string) {
      if (this.navigationHistory[this.navigationHistory.length - 1] !== path) {
        this.navigationHistory.push(path)
        // Keep only last 50 entries
        if (this.navigationHistory.length > 50) {
          this.navigationHistory = this.navigationHistory.slice(-50)
        }
      }
    },

    // Set pending redirect for post-auth navigation
    setPendingRedirect(path: string) {
      this.pendingRedirect = path
      console.log('[Navigation] Set pending redirect:', path)
    },

    // Clear pending redirect
    clearPendingRedirect() {
      const redirect = this.pendingRedirect
      this.pendingRedirect = null
      return redirect
    },

    // Check if user can access a route
    canAccessRoute(path: string): { canAccess: boolean; reason?: string; redirectTo?: string } {
      const authStore = useAuthStore()
      const route = Object.values(ROUTES).find(r => r.path === path)
      
      // If route not found in config, check if it's a dynamic route
      if (!route) {
        // Dynamic routes like /users/* should inherit parent requirements
        if (path.startsWith('/users/')) {
          const parentRoute = ROUTES.USERS
          return this.checkRouteAccess(parentRoute, authStore, path)
        }
        if (path.startsWith('/projects/')) {
          const parentRoute = ROUTES.PROJECTS
          return this.checkRouteAccess(parentRoute, authStore, path)
        }
        if (path.startsWith('/admin/')) {
          const parentRoute = ROUTES.ADMIN
          return this.checkRouteAccess(parentRoute, authStore, path)
        }
        
        // Unknown route - require auth by default
        if (!authStore.isAuthenticated) {
          const authUrl = buildAuthUrl(path)
          return { canAccess: false, reason: 'Authentication required', redirectTo: authUrl }
        }
        return { canAccess: true }
      }

      return this.checkRouteAccess(route, authStore, path)
    },

    // Helper to check route access
    checkRouteAccess(route: NavigationRoute, authStore: ReturnType<typeof useAuthStore>, path: string): { canAccess: boolean; reason?: string; redirectTo?: string } {
      // Public routes - anyone can access
      if (route.publicAccess) {
        // If user is already authenticated and this is a login page, redirect to dashboard
        if (authStore.isAuthenticated && route.redirectOnAuth) {
          return { canAccess: false, reason: 'Already authenticated', redirectTo: route.redirectOnAuth }
        }
        return { canAccess: true }
      }

      // Authentication required
      if (route.requiresAuth && !authStore.isAuthenticated) {
        const authUrl = buildAuthUrl(path)
        return { canAccess: false, reason: 'Authentication required', redirectTo: authUrl }
      }

      // Admin required
      if (route.requiresAdmin && !authStore.isAdmin) {
        const authUrl = buildAuthUrl(path)
        return { canAccess: false, reason: 'Admin access required', redirectTo: `${authUrl}&error=unauthorized` }
      }

      // Email verification required
      if (route.requiresVerification && !authStore.isEmailVerified) {
        return { canAccess: false, reason: 'Email verification required', redirectTo: '/auth/verify-email' }
      }

      // Account must be active
      if (route.requiresAuth && !authStore.isActive) {
        const authUrl = buildAuthUrl(path)
        return { canAccess: false, reason: 'Account deactivated', redirectTo: `${authUrl}&error=deactivated` }
      }

      // Account must not be locked
      if (route.requiresAuth && authStore.isAccountLocked) {
        const authUrl = buildAuthUrl(path)
        return { canAccess: false, reason: 'Account locked', redirectTo: `${authUrl}&error=locked` }
      }

      return { canAccess: true }
    },

    // Navigate to a route with access checks
    async navigateTo(path: string, options: { force?: boolean; replace?: boolean; external?: boolean } = {}) {
      try {
        this.isNavigating = true
        this.error = null

        console.log('[Navigation] Attempting to navigate to:', path)

        // External links
        if (options.external) {
          if (process.client) {
            window.open(path, '_blank')
          }
          return true
        }

        // Force navigation bypasses access checks
        if (!options.force) {
          const accessCheck = this.canAccessRoute(path)
          
          if (!accessCheck.canAccess) {
            console.log('[Navigation] Access denied:', accessCheck.reason)
            
            if (accessCheck.redirectTo) {
              console.log('[Navigation] Redirecting to:', accessCheck.redirectTo)
              // Don't use this.navigateTo to avoid infinite recursion
              await navigateTo(accessCheck.redirectTo, { replace: true })
              return false
            }
            
            this.error = accessCheck.reason || 'Access denied'
            return false
          }
        }

        // Update navigation state
        this.previousRoute = this.currentRoute
        this.currentRoute = path
        this.addToHistory(path)

        // Perform navigation
        await navigateTo(path, { replace: options.replace })
        
        console.log('[Navigation] Successfully navigated to:', path)
        return true

      } catch (error) {
        console.error('[Navigation] Navigation failed:', error)
        this.error = error instanceof Error ? error.message : 'Navigation failed'
        return false
      } finally {
        this.isNavigating = false
      }
    },

    // Post-login navigation handling
    async handlePostLoginNavigation(defaultPath: string = APP_CONFIG.defaultRedirect) {
      try {
        console.log('[Navigation] Handling post-login navigation')
        
        // Set recent login flag for middleware
        setRecentLogin()
        
        // Check for pending redirect
        const pendingRedirect = this.clearPendingRedirect()
        const targetPath = pendingRedirect || defaultPath
        
        console.log('[Navigation] Post-login target:', targetPath)
        
        // Small delay to ensure auth state is fully updated
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Navigate to target path
        const success = await this.navigateTo(targetPath, { force: true, replace: true })
        
        if (!success) {
          console.warn('[Navigation] Post-login navigation failed, falling back to dashboard')
          await this.navigateTo(APP_CONFIG.defaultRedirect, { force: true, replace: true })
        }
        
      } catch (error) {
        console.error('[Navigation] Post-login navigation error:', error)
        // Fallback to dashboard
        await this.navigateTo(APP_CONFIG.defaultRedirect, { force: true, replace: true })
      }
    },

    // Post-logout navigation
    async handlePostLogoutNavigation() {
      try {
        console.log('[Navigation] Handling post-logout navigation')
        
        // Clear auth flags
        clearRecentLogin()
        
        // Navigate to auth page using relative path
        await this.navigateTo(APP_CONFIG.authPath, { force: true, replace: true })
        
      } catch (error) {
        console.error('[Navigation] Post-logout navigation error:', error)
        // Force reload as fallback with full URL
        if (process.client) {
          window.location.href = buildFullUrl(APP_CONFIG.authPath)
        }
      }
    },

    // Quick navigation helpers
    async goToDashboard() {
      return await this.navigateTo(APP_CONFIG.defaultRedirect)
    },

    async goToLogin(redirectPath?: string) {
      const authUrl = buildAuthUrl(redirectPath)
      return await this.navigateTo(authUrl)
    },

    async goToProfile() {
      return await this.navigateTo('/users/profile')
    },

    async goToSettings() {
      return await this.navigateTo('/users/settings')
    },

    async goToProjects() {
      return await this.navigateTo('/projects')
    },

    async goToAdmin() {
      return await this.navigateTo('/admin')
    },

    async goBack() {
      if (this.previousRoute) {
        return await this.navigateTo(this.previousRoute)
      }
      
      // Fallback to browser back
      if (process.client && window.history.length > 1) {
        window.history.back()
        return true
      }
      
      // Ultimate fallback to dashboard
      return await this.goToDashboard()
    },

    // Get route metadata
    getRouteInfo(path: string) {
      return Object.values(ROUTES).find(r => r.path === path) || null
    },

    // Get all routes by category
    getPublicRoutes() {
      return Object.values(ROUTES).filter(r => r.publicAccess)
    },

    getAuthenticatedRoutes() {
      return Object.values(ROUTES).filter(r => r.requiresAuth && !r.requiresAdmin)
    },

    getAdminRoutes() {
      return Object.values(ROUTES).filter(r => r.requiresAdmin)
    },

    // Clear navigation state
    reset() {
      this.currentRoute = null
      this.previousRoute = null
      this.pendingRedirect = null
      this.navigationHistory = []
      this.isNavigating = false
      this.error = null
    },

    // Clear error
    clearError() {
      this.error = null
    },

    // Centralized URL builders
    buildAuthUrl(redirectPath?: string): string {
      return buildAuthUrl(redirectPath)
    },

    buildUrl(path: string): string {
      return buildUrl(path)
    },

    buildFullUrl(path: string): string {
      return buildFullUrl(path)
    },

    // Get app configuration
    getAppConfig() {
      return { ...APP_CONFIG }
    },
  },
})

// Export route constants and configuration for use in components
export { ROUTES, APP_CONFIG }
