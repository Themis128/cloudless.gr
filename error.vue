<template>
  <div class="error-page">
    <div class="error-container">
      <!-- Error Icon -->
      <div class="error-icon">
        <v-icon 
          :icon="getErrorIcon()" 
          size="120" 
          :color="getErrorColor()"
        />
      </div>
      
      <!-- Error Title -->
      <h1 class="error-title">
        {{ getErrorTitle() }}
      </h1>
      
      <!-- Error Message -->
      <p class="error-message">
        {{ error.message || 'Something went wrong' }}
      </p>
      
      <!-- Error Details for Development -->
      <div v-if="isDev" class="error-details">
        <v-card variant="outlined" class="mt-4">
          <v-card-title class="text-subtitle-2">
            Error Details (Development Only)
          </v-card-title>
          <v-card-text>
            <div class="text-caption">
              <strong>Status:</strong> {{ error.statusCode }}
            </div>
            <div class="text-caption">
              <strong>Path:</strong> {{ error.url }}
            </div>
            <div v-if="error.stack" class="text-caption mt-2">
              <strong>Stack:</strong>
              <pre class="error-stack">{{ error.stack }}</pre>
            </div>
          </v-card-text>
        </v-card>
      </div>
      
      <!-- Action Buttons -->
      <div class="error-actions">
        <v-btn
          color="primary"
          size="large"
          @click="handleError"
          class="mr-4"
        >
          <v-icon start>mdi-home</v-icon>
          Go Home
        </v-btn>
        
        <v-btn
          variant="outlined"
          size="large"
          @click="goBack"
          class="mr-4"
        >
          <v-icon start>mdi-arrow-left</v-icon>
          Go Back
        </v-btn>
        
        <v-btn
          variant="text"
          size="large"
          @click="refresh"
        >
          <v-icon start>mdi-refresh</v-icon>
          Refresh
        </v-btn>
      </div>
      
      <!-- Pipeline-specific Help -->
      <div v-if="isPipelineError()" class="pipeline-help">
        <v-card variant="tonal" color="info" class="mt-6">
          <v-card-title class="text-subtitle-2">
            <v-icon start>mdi-help-circle</v-icon>
            Pipeline Help
          </v-card-title>
          <v-card-text>
            <ul class="help-list">
              <li>Check if the pipeline exists and you have access to it</li>
              <li>Verify your pipeline configuration is valid</li>
              <li>Ensure you haven't exceeded your pipeline limits</li>
              <li>Contact support if the issue persists</li>
            </ul>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const error = useError()
const isDev = process.env.NODE_ENV === 'development'

const getErrorIcon = () => {
  const statusCode = error.value?.statusCode
  
  switch (statusCode) {
    case 404:
      return 'mdi-file-question'
    case 403:
      return 'mdi-lock'
    case 401:
      return 'mdi-login'
    case 429:
      return 'mdi-timer-sand'
    case 500:
      return 'mdi-alert-circle'
    default:
      return 'mdi-alert'
  }
}

const getErrorColor = () => {
  const statusCode = error.value?.statusCode
  
  switch (statusCode) {
    case 404:
      return 'warning'
    case 403:
    case 401:
      return 'error'
    case 429:
      return 'warning'
    case 500:
      return 'error'
    default:
      return 'grey'
  }
}

const getErrorTitle = () => {
  const statusCode = error.value?.statusCode
  
  switch (statusCode) {
    case 404:
      return 'Page Not Found'
    case 403:
      return 'Access Denied'
    case 401:
      return 'Authentication Required'
    case 429:
      return 'Too Many Requests'
    case 500:
      return 'Server Error'
    default:
      return 'Something Went Wrong'
  }
}

const isPipelineError = () => {
  const url = error.value?.url || ''
  return url.includes('/pipelines/')
}

const handleError = () => {
  clearError({ redirect: '/' })
}

const goBack = () => {
  if (process.client) {
    window.history.back()
  }
}

const refresh = () => {
  if (process.client) {
    window.location.reload()
  }
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.error-container {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.error-icon {
  margin-bottom: 2rem;
}

.error-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1.125rem;
  color: #6c757d;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.error-actions {
  margin-bottom: 2rem;
}

.error-details {
  text-align: left;
}

.error-stack {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.75rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.help-list {
  text-align: left;
  margin: 0;
  padding-left: 1.5rem;
}

.help-list li {
  margin-bottom: 0.5rem;
  color: #495057;
}

@media (max-width: 768px) {
  .error-container {
    padding: 2rem;
  }
  
  .error-title {
    font-size: 2rem;
  }
  
  .error-actions {
    flex-direction: column;
    gap: 1rem;
  }
  
  .error-actions .v-btn {
    width: 100%;
  }
}
</style> 