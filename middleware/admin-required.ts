// middleware/admin-required.ts

import { navigateTo } from '#imports'
import type { NavigationFailure, RouteLocationAsPathGeneric, RouteLocationAsRelativeGeneric, RouteLocationNormalizedLoaded } from 'vue-router'

interface User {
  id: string
  email: string
  role: string
}

// Nuxt 3: Use built-in defineNuxtRouteMiddleware for route protection
export default defineNuxtRouteMiddleware((to) => {
  // Only run on client (localStorage is not available on server)
  if (typeof window !== 'undefined') {
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
    // ❌ Not authorized → redirect
    return navigateTo(`/auth/admin-login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  // On server, do not block navigation (but recommend API-side validation for true security)
  // See: https://nuxt.com/docs/guide/directory-structure/middleware#server-side-middleware
})
