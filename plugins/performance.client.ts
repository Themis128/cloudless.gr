export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Only enable in production
  if (!config.public.performance?.enabled) {
    return
  }

  // Track Core Web Vitals
  if (config.public.performance.metrics?.enableCoreWebVitals) {
    trackCoreWebVitals()
  }

  // Track Real User Monitoring
  if (config.public.performance.metrics?.enableRealUserMonitoring) {
    trackRealUserMonitoring()
  }
})

function trackCoreWebVitals() {
  // Track Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]

      if (lastEntry) {
        const lcp = lastEntry.startTime
        console.log('LCP:', lcp)

        // Send to analytics if configured
        if (lcp > 2500) {
          console.warn('LCP is above recommended threshold:', lcp)
        }
      }
    })

    observer.observe({ entryTypes: ['largest-contentful-paint'] })
  }

  // Track First Input Delay (FID)
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries()

      entries.forEach(entry => {
        const fid = entry.processingStart - entry.startTime
        console.log('FID:', fid)

        if (fid > 100) {
          console.warn('FID is above recommended threshold:', fid)
        }
      })
    })

    observer.observe({ entryTypes: ['first-input'] })
  }

  // Track Cumulative Layout Shift (CLS)
  let clsValue = 0
  let clsEntries: any[] = []

  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries()

      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
          clsEntries.push(entry)
        }
      })

      console.log('CLS:', clsValue)

      if (clsValue > 0.1) {
        console.warn('CLS is above recommended threshold:', clsValue)
      }
    })

    observer.observe({ entryTypes: ['layout-shift'] })
  }
}

function trackRealUserMonitoring() {
  // Track page load performance
  window.addEventListener('load', () => {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming

      if (navigation) {
        const metrics = {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.requestStart,
          domLoad: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          windowLoad: navigation.loadEventEnd - navigation.loadEventStart,
          total: navigation.loadEventEnd - navigation.fetchStart,
        }

        console.log('Page Load Metrics:', metrics)

        // Send to analytics service
        sendMetricsToAnalytics('page_load', metrics)
      }
    }
  })

  // Track API call performance
  const originalFetch = window.fetch
  window.fetch = async function (...args) {
    const startTime = performance.now()

    try {
      const response = await originalFetch.apply(this, args)
      const endTime = performance.now()
      const duration = endTime - startTime

      console.log('API Call Duration:', duration, 'ms')

      if (duration > 1000) {
        console.warn('Slow API call detected:', duration, 'ms')
      }

      // Send to analytics service
      sendMetricsToAnalytics('api_call', {
        url: args[0],
        duration,
        status: response.status,
      })

      return response
    } catch (error) {
      const endTime = performance.now()
      const duration = endTime - startTime

      console.error('API Call Failed:', duration, 'ms', error)

      // Send error to analytics service
      sendMetricsToAnalytics('api_error', {
        url: args[0],
        duration,
        error: error.message,
      })

      throw error
    }
  }
}

function sendMetricsToAnalytics(type: string, data: any) {
  const config = useRuntimeConfig()

  // Send to configured analytics service
  if (config.public.analytics?.googleAnalyticsId) {
    // Send to Google Analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'performance_metric', {
        event_category: 'performance',
        event_label: type,
        value: data.duration || data.total || 0,
        custom_parameters: data,
      })
    }
  }

  if (config.public.analytics?.mixpanelToken) {
    // Send to Mixpanel
    if (typeof mixpanel !== 'undefined') {
      mixpanel.track('Performance Metric', {
        type,
        ...data,
      })
    }
  }
}
