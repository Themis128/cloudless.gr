export default defineNuxtRouteMiddleware(async (to: any) => {
  // Only run on client side
  if (process.client) {
    // Get auth state from store
    const authStore = useAuthStore()

    // Skip auth check for public routes
    const publicRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/',
      '/about',
      '/contact',
      '/privacy',
      '/terms',
      '/cookies',
      '/faq',
      '/pricing',
      '/support',
      '/blog',
      '/sitemap',
      '/community',
      '/careers',
      '/api-reference',
      '/api-playground',
      '/documentation',
      '/tutorials',
      '/responsive-demo',
      '/codegen',
      '/components',
      '/layout-only',
      '/test-error',
      '/prisma-test',
      '/todos',
      '/users',
      '/register',
      '/login',
      '/profile',
      '/deploy',
      '/dashboard',
      '/debug',
      '/debug/**',
      '/projects',
      '/bots',
      '/models',
      '/pipelines',
      '/llm',
      '/llm/**',
      '/tools/**',
      '/settings/**',
      '/profile/**',
      '/dashboard/**',
      '/projects/**',
      '/bots/**',
      '/models/**',
      '/pipelines/**',
      '/admin/**',
      '/api/**',
      '/.well-known/**',
      '/navigation-test',
    ]

    // Check if the current route is public
    const isPublicRoute = publicRoutes.some(route => {
      if (route.endsWith('/**')) {
        const baseRoute = route.slice(0, -3)
        return to.path.startsWith(baseRoute)
      }
      return to.path === route
    })

    if (isPublicRoute) {
      return
    }

    // For protected routes, check authentication
    if (!authStore.isAuthenticated) {
      // Redirect to login page with redirect parameter
      return navigateTo(
        `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`
      )
    }
  }
})
