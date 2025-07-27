<template>
  <div class="error-page">
    <v-container class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <v-card class="error-card" elevation="8" rounded="xl">
            <v-card-text class="pa-8">
              <!-- Error Icon -->
              <div class="error-icon mb-6">
                <v-icon size="80" color="error">
                  {{ errorIcon }}
                </v-icon>
              </div>

              <!-- Error Title -->
              <h1 class="text-h3 font-weight-bold mb-4">
                {{ errorTitle }}
              </h1>

              <!-- Error Message -->
              <p class="text-h6 text-medium-emphasis mb-6">
                {{ errorMessage }}
              </p>

              <!-- Error Details (Development Only) -->
              <v-expand-transition>
                <div v-if="isDev && error?.details" class="mb-6">
                  <v-alert type="info" variant="tonal" class="mb-4">
                    <template #title>
                      <strong>Error Details (Development)</strong>
                    </template>
                    <pre class="error-details">{{ error.details }}</pre>
                  </v-alert>
                </div>
              </v-expand-transition>

              <!-- Action Buttons -->
              <div class="d-flex flex-wrap justify-center gap-4">
                <v-btn
                  color="primary"
                  size="large"
                  variant="elevated"
                  @click="handleError"
                  prepend-icon="mdi-refresh"
                >
                  Try Again
                </v-btn>

                <v-btn
                  color="secondary"
                  size="large"
                  variant="outlined"
                  to="/"
                  prepend-icon="mdi-home"
                >
                  Go Home
                </v-btn>

                <v-btn
                  v-if="!isDev"
                  color="info"
                  size="large"
                  variant="text"
                  @click="reportError"
                  prepend-icon="mdi-bug"
                >
                  Report Issue
                </v-btn>
              </div>

              <!-- Error Code -->
              <div v-if="error?.statusCode" class="mt-6">
                <v-chip color="grey" variant="outlined">
                  Error {{ error.statusCode }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
interface ErrorProps {
  error: {
    statusCode?: number
    statusMessage?: string
    message?: string
    details?: string
  }
}

const props = defineProps<ErrorProps>()

// Computed properties for error handling
const isDev = computed(() => process.env.NODE_ENV === 'development')

const errorIcon = computed(() => {
  const statusCode = props.error?.statusCode
  switch (statusCode) {
    case 404:
      return 'mdi-map-marker-question'
    case 403:
      return 'mdi-shield-lock'
    case 500:
      return 'mdi-server-off'
    case 503:
      return 'mdi-wrench'
    default:
      return 'mdi-alert-circle'
  }
})

const errorTitle = computed(() => {
  const statusCode = props.error?.statusCode
  switch (statusCode) {
    case 404:
      return 'Page Not Found'
    case 403:
      return 'Access Denied'
    case 500:
      return 'Server Error'
    case 503:
      return 'Service Unavailable'
    default:
      return 'Something Went Wrong'
  }
})

const errorMessage = computed(() => {
  const statusCode = props.error?.statusCode
  switch (statusCode) {
    case 404:
      return 'The page you are looking for does not exist or has been moved.'
    case 403:
      return 'You do not have permission to access this resource.'
    case 500:
      return 'An internal server error occurred. Please try again later.'
    case 503:
      return 'The service is temporarily unavailable. Please try again later.'
    default:
      return props.error?.message || 'An unexpected error occurred. Please try again.'
  }
})

// Methods
const handleError = () => {
  clearError({ redirect: '/' })
}

const reportError = () => {
  // In a real app, you would send this to your error reporting service
  const errorData = {
    url: window.location.href,
    error: props.error,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  }

  console.error('Error Report:', errorData)

  // You could send this to Sentry, LogRocket, or your own error tracking service
  // Example: Sentry.captureException(props.error)

  // Show success message
  // You could use a toast notification here
  alert('Error reported successfully. Thank you for your feedback!')
}

// Set page title
useHead({
  title: `${errorTitle.value} - Cloudless`,
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }
  ]
})
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.error-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.error-icon {
  animation: pulse 2s infinite;
}

.error-details {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .error-card {
    margin: 1rem;
  }

  h1 {
    font-size: 1.75rem !important;
  }

  p {
    font-size: 1rem !important;
  }
}
</style>
