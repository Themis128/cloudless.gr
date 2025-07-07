import type { RouteLocationNormalized } from 'vue-router'

/**
 * Global authentication middleware
 * Vue 3 + Vuetify 3 best practices:
 * - Use composables for reactive state
 * - Implement proper error handling
 * - Optimize performance with early returns
 */
export default defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
  // Early return for excluded routes
  const excludedRoutes = ['/', '/info', '/auth', '/privacy', '/terms']
  const isExcluded = excludedRoutes.some(route => 
    to.path === route || to.path.startsWith('/info/') || to.path.startsWith('/auth/')
  )
  
  if (isExcluded) return

  // Use reactive user state
  const { user } = useSupabaseUser()
  
  // Redirect to auth if not authenticated
  if (!user.value) {
    return navigateTo('/auth/login')
  }
})