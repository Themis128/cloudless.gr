// middleware/00.performance.global.ts - Performance monitoring middleware
export default defineNuxtRouteMiddleware((to) => {
  if (process.dev) {
    const startTime = performance.now()
    
    // Add middleware timing to route meta
    to.meta.middlewareStart = startTime
    
    // Log performance in development
    console.log(`🚀 Middleware start for ${to.path}`, {
      timestamp: new Date().toISOString(),
      path: to.path
    })
  }
})
