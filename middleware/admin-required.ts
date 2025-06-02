// middleware/admin-required.ts

import { navigateTo } from '#app'
import type { NavigationFailure, RouteLocationAsPathGeneric, RouteLocationAsRelativeGeneric, RouteLocationNormalizedLoaded } from 'vue-router'

interface User {
  id: string
  email: string
  role: string
}

// Nuxt 3 provides defineNuxtRouteMiddleware globally, but if you need to define it manually for testing or SSR, use this:
function defineNuxtRouteMiddleware(
  middleware: (to: RouteLocationNormalizedLoaded) => string | false | void | RouteLocationAsRelativeGeneric | RouteLocationAsPathGeneric | Promise<false | void | NavigationFailure>
) {
  return middleware
}

export default defineNuxtRouteMiddleware((to: RouteLocationNormalizedLoaded) => {
  if (process.client) {
    const adminToken = localStorage.getItem('admin_token')
    const adminUser = localStorage.getItem('admin_user')

    if (adminToken && adminUser) {
      try {
        const userData = JSON.parse(adminUser) as User
        if (userData.role === 'admin') {
          return // ✅ Authorized
        }
      } catch (error) {
        console.error('Invalid admin user data:', error)
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
      }
    }
  }

  // ❌ Not authorized → redirect
  return navigateTo(`/auth/admin-login?redirect=${encodeURIComponent(to.fullPath)}`)
})
