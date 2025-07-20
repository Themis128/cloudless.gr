<template>
  <div class="test-error-page">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="8">
          <GradientCard variant="primary" class="test-card">
            <h1 class="text-h4 mb-4">Error Page Testing</h1>
            <p class="text-body-1 mb-6">
              Test different error scenarios to see your custom error pages in action.
            </p>
            
            <v-row>
              <v-col cols="12" sm="6">
                <v-card class="error-test-card">
                  <v-card-title>404 Error</v-card-title>
                  <v-card-text>
                    Test the custom 404 error page
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      color="info"
                      @click="trigger404"
                      block
                    >
                      Trigger 404
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6">
                <v-card class="error-test-card">
                  <v-card-title>500 Error</v-card-title>
                  <v-card-text>
                    Test the custom 500 error page
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      color="error"
                      @click="trigger500"
                      block
                    >
                      Trigger 500
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6">
                <v-card class="error-test-card">
                  <v-card-title>Custom Error</v-card-title>
                  <v-card-text>
                    Test a custom error with message
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      color="warning"
                      @click="triggerCustomError"
                      block
                    >
                      Trigger Custom Error
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6">
                <v-card class="error-test-card">
                  <v-card-title>Runtime Error</v-card-title>
                  <v-card-text>
                    Test a JavaScript runtime error
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      color="secondary"
                      @click="triggerRuntimeError"
                      block
                    >
                      Trigger Runtime Error
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
            
            <v-divider class="my-6"></v-divider>
            
            <div class="text-center">
              <v-btn
                color="primary"
                to="/"
                variant="elevated"
              >
                <v-icon start>mdi-home</v-icon>
                Back to Dashboard
              </v-btn>
            </div>
          </GradientCard>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { createError } from '#app'
import GradientCard from '~/components/ui/GradientCard.vue'

// Methods to trigger different errors
const trigger404 = () => {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page Not Found',
    message: 'This is a test 404 error'
  })
}

const trigger500 = () => {
  throw createError({
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: 'This is a test 500 error'
  })
}

const triggerCustomError = () => {
  throw createError({
    statusCode: 418,
    statusMessage: 'I\'m a Teapot',
    message: 'This is a custom test error with a funny status code!'
  })
}

const triggerRuntimeError = () => {
  // This will trigger a JavaScript runtime error
  const undefinedVariable = undefined
  undefinedVariable.someMethod()
}
</script>

<style scoped>
.test-error-page {
  padding: 2rem 0;
  min-height: 100vh;
}

.test-card {
  padding: 2rem;
}

.error-test-card {
  height: 100%;
  transition: transform 0.3s ease;
}

.error-test-card:hover {
  transform: translateY(-2px);
}

.v-card-actions {
  padding: 1rem;
}
</style> 