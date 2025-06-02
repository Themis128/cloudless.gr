import { defineNuxtRouteMiddleware, navigateTo } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'

export default defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
  // Allow access to auth routes and public pages
  if (to.path.startsWith('/auth/') ||
      to.path === '/' ||
      to.path === '/about' ||
      to.path === '/contact' ||
      to.path === '/docs' ||
      to.path.startsWith('/admin/')) {
    return
  }

  // Check authentication on client side
  if (process.client) {
    const token = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')

    if (!token || !storedUser) {
      return navigateTo('/auth/login')
    }

    try {
      const userData = JSON.parse(storedUser)
      if (!userData || !userData.id) {
        return navigateTo('/auth/login')
      }
    } catch (error) {
      // Clear invalid data and redirect
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      return navigateTo('/auth/login')
    }
  }
})
