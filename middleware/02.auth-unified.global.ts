// middleware/02.auth-unified.global.ts - Unified authentication middleware
import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#imports'
import { requiresAuth, requiresAdmin, isStaticAsset, isPublicRoute } from './utils/route-protection'

export default defineNuxtRouteMiddleware(async (to) => {
  console.log('Auth middleware running for:', to.path)
  
  // Skip middleware for static assets and API routes
  if (isStaticAsset(to.path)) {
    console.log('Skipping static asset:', to.path)
    return
  }

  // Allow public routes without checks
  if (isPublicRoute(to.path)) {
    console.log('Public route, allowing:', to.path)
    return
  }

  // Skip auth check if we're already on an auth page to prevent loops
  if (to.path.startsWith('/auth/')) {
    console.log('On auth page, skipping middleware:', to.path)
    return
  }

  console.log('Running auth check for:', to.path)
  try {
    // Get session from server-side validation
    const session = await $fetch('/api/auth/session')

    // Store session in Nuxt app context for components to access
    const nuxtApp = useNuxtApp()
    nuxtApp.$auth = session

    // Auto-redirect authenticated admins to admin dashboard from home
    if (to.path === '/' && session?.authenticated && session.role === 'admin') {
      return navigateTo('/admin/dashboard')
    }    // Route protection logic
    if (requiresAdmin(to.path)) {
      console.log('Route requires admin:', to.path, 'Session:', session)
      if (!session?.authenticated || session.role !== 'admin') {
        console.log('Redirecting to admin warning page')
        return navigateTo(`/admin-warning?redirect=${encodeURIComponent(to.fullPath)}`)
      }
    } else if (requiresAuth(to.path)) {
      console.log('Route requires auth:', to.path, 'Session:', session)
      if (!session?.authenticated) {
        console.log('Redirecting to user login')
        return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
      }    }

    // All checks passed, continue to route
  } catch (error) {
    console.error('Auth middleware error:', error)
    
    // On error, redirect to appropriate page based on route
    if (requiresAdmin(to.path)) {
      return navigateTo('/admin-warning')
    } else if (requiresAuth(to.path)) {
      return navigateTo('/auth/login')
    }
  }
})
