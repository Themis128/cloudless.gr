export default defineNuxtPlugin(() => {
  const { $pinia } = useNuxtApp()

  // Initialize enhanced stores
  const persistenceStore = usePersistenceStore()
  const globalStateStore = useGlobalStateStore()
  const cacheStore = useCacheStore()
  const errorHandlingStore = useErrorHandlingStore()
  const performanceStore = usePerformanceStore()

  // Register stores for persistence
  persistenceStore.registerStore('auth', {
    key: 'cloudless-auth-state',
    storage: 'localStorage',
    debounce: 500,
  })

  persistenceStore.registerStore('user', {
    key: 'cloudless-user-state',
    storage: 'localStorage',
    debounce: 300,
  })

  persistenceStore.registerStore('bot-builder', {
    key: 'cloudless-bot-builder-state',
    storage: 'sessionStorage',
    debounce: 1000,
  })

  persistenceStore.registerStore('pipeline-builder', {
    key: 'cloudless-pipeline-builder-state',
    storage: 'sessionStorage',
    debounce: 1000,
  })

  // Register error handlers
  errorHandlingStore.registerErrorHandler(
    /network|fetch|timeout/i,
    async error => {
      console.warn('Network error detected, attempting recovery...')
      // Could trigger retry logic or show user notification
    },
    10
  )

  errorHandlingStore.registerErrorHandler(
    /unauthorized|auth/i,
    async error => {
      console.warn('Authentication error detected')
      const authStore = useAuthStore()
      await authStore.logout()
      // Redirect to login
      await navigateTo('/auth/login')
    },
    20
  )

  errorHandlingStore.registerErrorHandler(
    /validation|invalid/i,
    async error => {
      console.warn('Validation error detected')
      // Could show user-friendly validation messages
    },
    5
  )

  // Register recovery strategies
  errorHandlingStore.registerRecoveryStrategy(
    'network',
    async error => {
      // Simple retry strategy for network errors
      await new Promise(resolve => setTimeout(resolve, 1000))
      return true // Assume recovery successful
    },
    3
  )

  errorHandlingStore.registerRecoveryStrategy(
    'database',
    async error => {
      // Database recovery strategy
      const prismaStore = usePrismaStore()
      try {
        // Attempt to reconnect or refresh connection
        await prismaStore.apiCall('/api/health')
        return true
      } catch {
        return false
      }
    },
    2
  )

  // Start performance monitoring
  performanceStore.startMonitoring()

  // Hydrate persisted stores on app start
  persistenceStore.hydrateAll()

  // Listen for store hydration events
  if (process.client) {
    window.addEventListener('store-hydrate', (event: any) => {
      const { storeName, state } = event.detail
      console.log(`Hydrated store: ${storeName}`, state)
    })
  }

  // Enhanced $fetch with performance tracking and caching
  const originalFetch = globalThis.$fetch
  globalThis.$fetch = async (request: any, options?: any): Promise<any> => {
    const startTime = performance.now()
    const endpoint =
      typeof request === 'string' ? request : request.url || 'unknown'
    const method = options?.method || 'GET'

    try {
      // Check cache first for GET requests
      if (method === 'GET') {
        const cacheKey = `api_${method}_${endpoint}`
        const cached = cacheStore.getCached(cacheKey)
        if (cached) {
          performanceStore.trackAPICall(endpoint, method, 0, 200, true)
          return cached
        }
      }

      const response: any = await originalFetch(request, options)
      const duration = performance.now() - startTime
      const success = response && !response.error

      // Track performance
      performanceStore.trackAPICall(
        endpoint,
        method,
        duration,
        (response as any)?.status || 200,
        success,
        (response as any)?.error
      )

      // Cache successful GET responses
      if (method === 'GET' && success) {
        const cacheKey = `api_${method}_${endpoint}`
        cacheStore.setCached(cacheKey, response, 5 * 60 * 1000, ['api', 'get'])
      }

      // Track errors
      if (!success) {
        errorHandlingStore.addError(
          (response as any)?.error || 'API call failed',
          { endpoint, method, response },
          'medium',
          'api'
        )
      }

      return response
    } catch (error: any) {
      const duration = performance.now() - startTime

      // Track failed API call
      performanceStore.trackAPICall(
        endpoint,
        method,
        duration,
        0,
        false,
        error.message
      )

      // Add to error handling
      errorHandlingStore.addError(error, { endpoint, method }, 'high', 'api')

      throw error
    }
  }

  // Provide enhanced stores to the app
  return {
    provide: {
      enhancedStores: {
        persistence: persistenceStore,
        globalState: globalStateStore,
        cache: cacheStore,
        errorHandling: errorHandlingStore,
        performance: performanceStore,
      },
    },
  }
})
