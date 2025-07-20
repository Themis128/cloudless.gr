<template>
  <div class="error-page">
    <!-- Spotlight Background -->
    <div class="spotlight"></div>
    
    <!-- Main Content -->
    <div class="error-content">
      <GradientCard variant="primary" class="error-card">
        <div class="text-center">
          <!-- Error Icon -->
          <div class="error-icon">
            <v-icon size="120" color="error">
              {{ errorIcon }}
            </v-icon>
          </div>
          
          <!-- Error Code -->
          <h1 class="error-code">
            {{ error.statusCode }}
          </h1>
          
          <!-- Error Message -->
          <h2 class="error-title">
            {{ error.statusMessage }}
          </h2>
          
          <!-- Error Description -->
          <p class="error-description">
            {{ error.message || 'Something went wrong. Please try again.' }}
          </p>
          
          <!-- Action Buttons -->
          <div class="error-actions">
            <v-btn
              color="primary"
              size="large"
              variant="elevated"
              @click="handleError"
              class="mr-4"
            >
              <v-icon start>mdi-refresh</v-icon>
              Try Again
            </v-btn>
            
            <v-btn
              color="secondary"
              size="large"
              variant="outlined"
              to="/"
            >
              <v-icon start>mdi-home</v-icon>
              Go Home
            </v-btn>
          </div>
          
          <!-- Development Stack Trace -->
          <div v-if="showStack" class="error-stack">
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start>mdi-bug</v-icon>
                  Technical Details
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre class="stack-trace">{{ error.stack }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </div>
      </GradientCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { clearError } from '#app'
import GradientCard from '~/components/ui/GradientCard.vue'

interface ErrorProps {
  error: {
    statusCode?: number
    statusMessage?: string
    message?: string
    stack?: string
  }
}

const props = defineProps<ErrorProps>()

// Computed properties
const errorIcon = computed(() => {
  const code = props.error.statusCode
  switch (code) {
    case 404:
      return 'mdi-map-marker-question'
    case 403:
      return 'mdi-lock-alert'
    case 500:
      return 'mdi-server-off'
    case 503:
      return 'mdi-wrench'
    default:
      return 'mdi-alert-circle'
  }
})

const showStack = computed(() => {
  return process.dev && props.error.stack
})

// Methods
const handleError = () => {
  clearError({ redirect: '/' })
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

.error-content {
  max-width: 600px;
  width: 100%;
  z-index: 20;
}

.error-card {
  padding: 3rem 2rem;
}

.error-icon {
  margin-bottom: 2rem;
}

.error-code {
  font-size: 6rem;
  font-weight: 700;
  color: var(--v-error-base);
  margin: 0;
  line-height: 1;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.error-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--v-text-primary);
  margin: 1rem 0;
  line-height: 1.2;
}

.error-description {
  font-size: 1.1rem;
  color: var(--v-text-secondary);
  margin: 1.5rem 0;
  line-height: 1.6;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.error-actions {
  margin: 2rem 0;
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.error-stack {
  margin-top: 2rem;
  text-align: left;
}

.stack-trace {
  background: rgba(0, 0, 0, 0.05);
  padding: 1rem;
  border-radius: 0.5rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Responsive Design */
@media (max-width: 768px) {
  .error-page {
    padding: 1rem;
  }
  
  .error-card {
    padding: 2rem 1rem;
  }
  
  .error-code {
    font-size: 4rem;
  }
  
  .error-title {
    font-size: 1.5rem;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .v-btn {
    width: 100%;
    max-width: 300px;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .stack-trace {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style> 