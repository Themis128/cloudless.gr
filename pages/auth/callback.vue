<template>
  <div class="auth-callback-container">
    <v-container class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" md="6" class="text-center">
          <div v-if="loading">
            <v-progress-circular
              indeterminate
              color="primary"
              size="64"
              class="mb-4"
            />
            <h2 class="text-h5 mb-2">Completing Authentication...</h2>
            <p class="text-body-1 text-medium-emphasis">
              Please wait while we complete your authentication.
            </p>
          </div>
          
          <div v-else-if="error" class="error-state">
            <v-icon size="64" color="error" class="mb-4">
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h5 mb-2 text-error">Authentication Failed</h2>
            <p class="text-body-1 text-medium-emphasis mb-4">
              {{ error }}
            </p>
            <v-btn
              color="primary"
              variant="elevated"
              @click="navigateTo('/auth')"
            >
              Try Again
            </v-btn>
          </div>
          
          <div v-else class="success-state">
            <v-icon size="64" color="success" class="mb-4">
              mdi-check-circle-outline
            </v-icon>
            <h2 class="text-h5 mb-2 text-success">Authentication Successful!</h2>
            <p class="text-body-1 text-medium-emphasis">
              Redirecting you to your users page...
            </p>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import { navigateTo, useRoute, definePageMeta } from '#imports'

definePageMeta({ 
  layout: 'auth'
})

const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    // Use the same manual client as the auth middleware for consistency
    const { useManualSupabaseClient } = await import('~/composables/useManualSupabase')
    const supabase = useManualSupabaseClient()
    
    // Get the redirect query parameter
    const route = useRoute()
    const redirectToRaw = route.query.redirect as string
    const redirectTo = (!redirectToRaw || redirectToRaw === '/users/index') ? '/users' : redirectToRaw
    
    // Handle the auth callback
    const { data, error: authError } = await supabase.auth.getSession()
    
    if (authError) {
      throw authError
    }
    
    if (data.session) {
      // User is authenticated, redirect to the intended page
      console.log(`✅ Authentication successful, redirecting to ${redirectTo}`)
      await navigateTo(redirectTo)
    } else {
      // No session, redirect to login
      console.log('❌ No session found, redirecting to login')
      await navigateTo('/auth')
    }
  } catch (err) {
    console.error('Auth callback error:', err)
    error.value = err instanceof Error && err.message
      ? 'Error: ' + err.message
      : 'Authentication failed. Please try again.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.auth-callback-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.fill-height {
  min-height: 100vh;
}

.error-state,
.success-state {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
