<template>
  <div class="d-flex align-center justify-center fill-height">
    <v-card class="pa-8 text-center" elevation="3" rounded="lg" max-width="400">
      <!-- Loading State -->
      <div v-if="!error && !success">
        <v-progress-circular
          indeterminate
          size="64"
          color="primary"
          class="mb-4"
        />
        <h2 class="text-h5 mb-2">Completing Authentication...</h2>
        <p class="text-body-1 text-medium-emphasis">
          Please wait while we finish signing you in.
        </p>
      </div>

      <!-- Success State -->
      <div v-else-if="success">
        <v-icon
          icon="mdi-check-circle"
          size="64"
          color="success"
          class="mb-4"
        />
        <h2 class="text-h5 mb-2 text-success">Authentication Successful!</h2>
        <p class="text-body-1 text-medium-emphasis">
          Redirecting you to your dashboard...
        </p>
      </div>

      <!-- Error State -->
      <div v-else>
        <v-icon
          icon="mdi-alert-circle"
          size="64"
          color="error"
          class="mb-4"
        />
        <h2 class="text-h5 mb-2 text-error">Authentication Failed</h2>
        <p class="text-body-1 text-medium-emphasis mb-4">
          {{ errorMessage }}
        </p>
        <v-btn
          color="primary"
          variant="elevated"
          @click="redirectToLogin"
          block
        >
          Return to Login
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  public: true  // Callback page needs to be accessible during auth flow
})

const router = useRouter()
const route = useRoute()

// Reactive state
const loading = ref(true)
const error = ref(false)
const success = ref(false)
const errorMessage = ref('Something went wrong during authentication. Please try again.')

const redirectToLogin = () => {
  router.push('/auth/login')
}

onMounted(async () => {
  try {
    const supabase = useSupabaseClient()
    
    // Handle the auth callback
    const { data, error: authError } = await supabase.auth.getSession()
    
    if (authError) {
      throw authError
    }

    if (data.session) {
      success.value = true
      
      // Wait a moment to show success state, then redirect
      setTimeout(() => {
        const redirectTo = route.query.redirectTo as string || '/dashboard'
        router.push(redirectTo)
      }, 1500)
    } else {
      throw new Error('No session found')
    }
  } catch (err: any) {
    error.value = true
    errorMessage.value = err.message || 'Authentication failed. Please try again.'
    
    console.error('Auth callback error:', err)
    
    // Auto redirect to login after 5 seconds
    setTimeout(() => {
      redirectToLogin()
    }, 5000)
  } finally {
    loading.value = false
  }
})
</script>
