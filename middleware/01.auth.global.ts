import { defineNuxtRouteMiddleware, navigateTo } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'
import { jwtDecode } from 'jwt-decode'

export default defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
  // Allow access to public and auth routes without authentication
  if (
    to.path.startsWith('/auth/') ||
    to.path === '/' ||
    to.path === '/about' ||
    to.path === '/contact' ||
    to.path === '/docs'
  ) {
    return
  }

  // Check authentication on client side for all other routes (including /admin/)
  if (process.client) {
    const token = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')

    if (!token || !storedUser) {
      return navigateTo('/auth/login')
    }

    // JWT validation
    try {
      const decoded: any = jwtDecode(token)
      // Check for exp (expiration) claim
      if (!decoded || !decoded.exp || Date.now() / 1000 > decoded.exp) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        return navigateTo('/auth/login')
      }
      // Optionally: check for sub, email, or other claims
      // if (!decoded.sub || !decoded.email) { ... }
      const userData = JSON.parse(storedUser)
      if (!userData || !userData.id) {
        return navigateTo('/auth/login')
      }
    } catch {
      // Clear invalid data and redirect
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      return navigateTo('/auth/login')
    }
  }
})
