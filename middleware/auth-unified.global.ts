// Optimal unified authentication middleware
import { requiresAuth, requiresAdmin, isStaticAsset } from './utils/route-protection'

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for static assets and API routes
  if (isStaticAsset(to.path)) {
    return
  }

  try {
    // Get session from server-side validation
    const { data: session } = await $fetch('/api/auth/session')

    // Store session in Nuxt app context for components to access
    const nuxtApp = useNuxtApp()
    nuxtApp.$auth = session

    // Route protection logic
    if (requiresAdmin(to.path)) {
      if (!session?.authenticated || session.role !== 'admin') {
        return navigateTo(`/auth/admin-login?redirect=${encodeURIComponent(to.fullPath)}`)
      }
    } else if (requiresAuth(to.path)) {
      if (!session?.authenticated) {
        return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
      }
    }

    // All checks passed, continue to route
  } catch (error) {
    console.error('Auth middleware error:', error)
    
    // On error, redirect to appropriate login based on route
    if (requiresAdmin(to.path)) {
      return navigateTo('/auth/admin-login')
    } else if (requiresAuth(to.path)) {
      return navigateTo('/auth/login')
    }
  }
})
