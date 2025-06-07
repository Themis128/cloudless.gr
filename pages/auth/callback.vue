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
    
    // Get query parameters
    const { access_token, refresh_token, type, error: urlError, error_description, error_code, provider } = route.query

    // Handle URL errors first
    if (urlError) {
      const errorMsg = error_description as string || urlError as string
      
      // Handle specific error types
      if (error_code === 'otp_expired' || errorMsg.includes('expired')) {
        throw new Error('Your email confirmation link has expired. Please request a new confirmation email from the login page.')
      } else if (error_code === 'otp_invalid' || errorMsg.includes('invalid')) {
        throw new Error('The confirmation link is invalid. This may happen if you\'ve already confirmed your email or if the link was corrupted.')
      } else {
        throw new Error(decodeURIComponent(errorMsg).replace(/\+/g, ' '))
      }
    }

    // Handle different types of auth callbacks
    if (type === 'signup' && access_token && refresh_token) {
      // Email confirmation callback
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: access_token as string,
        refresh_token: refresh_token as string,
      })

      if (sessionError) {
        throw sessionError
      }

      success.value = true
      errorMessage.value = 'Email confirmed successfully! Welcome to Cloudless.'
      
      // Redirect to dashboard after showing success
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } else if (type === 'recovery') {
      // Password recovery callback
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: access_token as string,
          refresh_token: refresh_token as string,
        })

        if (sessionError) {
          throw sessionError
        }

        // Redirect to password reset page
        router.push('/auth/reset-password')
      } else {
        throw new Error('Invalid recovery link')
      }
    } else if (type === 'magiclink' && access_token && refresh_token) {
      // Magic link callback
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: access_token as string,
        refresh_token: refresh_token as string,
      })

      if (sessionError) {
        throw sessionError
      }

      success.value = true
      errorMessage.value = 'Magic link authentication successful! Welcome to Cloudless.'
      
      // Redirect to dashboard after showing success
      setTimeout(() => {
        const redirectTo = route.query.redirectTo as string || '/dashboard'
        router.push(redirectTo)
      }, 1500)
    } else if (type === 'oauth' && provider) {
      // OAuth callback (Google, GitHub, etc.)
      console.log(`Processing ${provider} OAuth callback...`)
      
      const { data, error: authError } = await supabase.auth.getSession()
      
      if (authError) {
        throw authError
      }

      if (data.session) {
        success.value = true
        errorMessage.value = `Successfully signed in with ${provider}! Welcome to Cloudless.`
        
        // Wait a moment to show success state, then redirect
        setTimeout(() => {
          const redirectTo = route.query.redirectTo as string || '/dashboard'
          router.push(redirectTo)
        }, 1500)
      } else {
        throw new Error(`No session found after ${provider} authentication`)
      }
    } else {
      // Regular auth callback (fallback for any other OAuth or session)
      const { data, error: authError } = await supabase.auth.getSession()
      
      if (authError) {
        throw authError
      }

      if (data.session) {
        success.value = true
        errorMessage.value = 'Authentication successful! Welcome to Cloudless.'
        
        // Wait a moment to show success state, then redirect
        setTimeout(() => {
          const redirectTo = route.query.redirectTo as string || '/dashboard'
          router.push(redirectTo)
        }, 1500)
      } else {
        // Try to handle implicit OAuth flow
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          console.log('Handling implicit OAuth flow from hash...')
          // Let Supabase handle the implicit flow
          const { data: hashData, error: hashError } = await supabase.auth.getSession()
          
          if (hashError) {
            throw hashError
          }
          
          if (hashData.session) {
            success.value = true
            errorMessage.value = 'Authentication successful! Welcome to Cloudless.'
            
            setTimeout(() => {
              const redirectTo = route.query.redirectTo as string || '/dashboard'
              router.push(redirectTo)
            }, 1500)
          } else {
            throw new Error('No session found')
          }
        } else {
          throw new Error('No session found')
        }
      }
    }} catch (err: any) {
    error.value = true
    const errorMsg = err.message || 'Authentication failed. Please try again.'
    errorMessage.value = errorMsg
    
    console.error('Auth callback error:', err)
    
    // Try to extract email from query parameters to help with resending
    const emailFromQuery = route.query.email as string
    
    // For expired OTP errors, redirect to login with error context and email
    if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
      setTimeout(() => {
        // Redirect to login page with error information and email if available
        const loginQuery: Record<string, string> = { auth_error: 'otp_expired' }
        if (emailFromQuery) {
          loginQuery.email = emailFromQuery
        }
        router.push({ path: '/auth/login', query: loginQuery })
      }, 3000)
    } else {
      // Auto redirect to login after 5 seconds for other errors
      setTimeout(() => {
        redirectToLogin()
      }, 5000)
    }
  } finally {
    loading.value = false
  }
})
</script>
