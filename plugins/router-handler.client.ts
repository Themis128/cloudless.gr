export default defineNuxtPlugin(() => {
  // Handle .well-known routes to prevent Vue Router warnings
  const router = useRouter()
  
  router.beforeEach((to, from, next) => {
    // If the route starts with .well-known, let the server handle it
    if (to.path.startsWith('/.well-known/')) {
      // This prevents Vue Router from trying to match these as client routes
      // The server-side API will handle the actual request
      next(false)
      return
    }
    next()
  })
}) 