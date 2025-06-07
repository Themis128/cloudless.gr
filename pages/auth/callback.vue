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
    
    console.log('🔍 AUTH CALLBACK DEBUG: Starting auth callback processing')
    console.log('📍 Current URL:', window.location.href)
    console.log('🔗 Route query:', route.query)
    console.log('🏷️ Route hash:', window.location.hash)
    
    // Get query parameters
    const { access_token, refresh_token, type, error: urlError, error_description, error_code, provider } = route.query

    // Handle URL errors first
    if (urlError) {
      const errorMsg = error_description as string || urlError as string
      console.log('❌ URL Error detected:', errorMsg)
      
      // Handle specific error types
      if (error_code === 'otp_expired' || errorMsg.includes('expired')) {
        throw new Error('Your email confirmation link has expired. Please request a new confirmation email from the login page.')
      } else if (error_code === 'otp_invalid' || errorMsg.includes('invalid')) {
        throw new Error('The confirmation link is invalid. This may happen if you\'ve already confirmed your email or if the link was corrupted.')
      } else {
        throw new Error(decodeURIComponent(errorMsg).replace(/\+/g, ' '))
      }
    }

    // Enhanced session detection - check multiple sources
    console.log('🔍 Checking for existing session...')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    console.log('📊 Session check result:', { data: sessionData, error: sessionError })

    // Method 1: If we already have a valid session, use it
    if (sessionData?.session && !sessionError) {
      console.log('✅ Found existing valid session')
      success.value = true
      errorMessage.value = 'Authentication successful! Welcome to Cloudless.'
      
      setTimeout(() => {
        const redirectTo = route.query.redirectTo as string || '/dashboard'
        router.push(redirectTo)
      }, 1500)
      return
    }

    // Method 2: Check for auth tokens in URL hash (Supabase implicit flow)
    const hash = window.location.hash
    if (hash && (hash.includes('access_token') || hash.includes('#'))) {
      console.log('🔍 Processing URL hash for auth tokens:', hash.substring(0, 100) + '...')
      
      // Let Supabase automatically handle the hash
      const { data: hashData, error: hashError } = await supabase.auth.getSession()
      console.log('📊 Hash processing result:', { data: hashData, error: hashError })
      
      if (hashData?.session && !hashError) {
        console.log('✅ Successfully processed auth tokens from hash')
        success.value = true
        errorMessage.value = 'Email confirmation successful! Welcome to Cloudless.'
        
        setTimeout(() => {
          const redirectTo = route.query.redirectTo as string || '/dashboard'
          router.push(redirectTo)
        }, 1500)
        return
      }
    }

    // Method 3: Manual token extraction and session setting
    if (access_token && refresh_token) {
      console.log('🔍 Manual token processing with query parameters')
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: access_token as string,
        refresh_token: refresh_token as string,
      })

      if (setSessionError) {
        console.log('❌ Manual session setting failed:', setSessionError)
        throw setSessionError
      }

      console.log('✅ Manual session setting successful')
      success.value = true
      errorMessage.value = 'Authentication successful! Welcome to Cloudless.'
      
      setTimeout(() => {
        const redirectTo = route.query.redirectTo as string || '/dashboard'
        router.push(redirectTo)
      }, 1500)
      return
    }    // Method 4: Handle specific auth types with fallbacks
    if (type === 'signup') {
      console.log('🔍 Processing signup confirmation callback')
      // Email confirmation callback - try multiple methods
      
      // Try session again after potential hash processing
      const { data: retryData, error: retryError } = await supabase.auth.getSession()
      if (retryData?.session && !retryError) {
        console.log('✅ Signup confirmation successful via session retry')
        success.value = true
        errorMessage.value = 'Email confirmed successfully! Welcome to Cloudless.'
        
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
        return
      }
    } else if (type === 'recovery') {
      console.log('🔍 Processing recovery callback')
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
        return
      } else {
        throw new Error('Invalid recovery link')
      }
    } else if (type === 'magiclink') {
      console.log('🔍 Processing magic link callback')
      // Magic link callback - session should already be established
      const { data: magicData, error: magicError } = await supabase.auth.getSession()
      
      if (magicData?.session && !magicError) {
        console.log('✅ Magic link authentication successful')
        success.value = true
        errorMessage.value = 'Magic link authentication successful! Welcome to Cloudless.'
        
        setTimeout(() => {
          const redirectTo = route.query.redirectTo as string || '/dashboard'
          router.push(redirectTo)
        }, 1500)
        return
      }
    } else if (type === 'oauth' && provider) {
      console.log(`🔍 Processing ${provider} OAuth callback`)
      // OAuth callback (Google, GitHub, etc.)
      
      const { data, error: authError } = await supabase.auth.getSession()
      
      if (authError) {
        throw authError
      }

      if (data.session) {
        success.value = true
        errorMessage.value = `Successfully signed in with ${provider}! Welcome to Cloudless.`
        
        setTimeout(() => {
          const redirectTo = route.query.redirectTo as string || '/dashboard'
          router.push(redirectTo)
        }, 1500)
        return
      } else {
        throw new Error(`No session found after ${provider} authentication`)
      }
    }

    // Method 5: Final fallback - wait a moment and check session again
    console.log('🔍 Final fallback: waiting and rechecking session...')
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
    
    const { data: finalData, error: finalError } = await supabase.auth.getSession()
    console.log('📊 Final session check:', { data: finalData, error: finalError })
    
    if (finalData?.session && !finalError) {
      console.log('✅ Session found in final check!')
      success.value = true
      errorMessage.value = 'Authentication successful! Welcome to Cloudless.'
      
      setTimeout(() => {
        const redirectTo = route.query.redirectTo as string || '/dashboard'
        router.push(redirectTo)
      }, 1500)
      return
    }

    // If we get here, authentication truly failed
    console.log('❌ All authentication methods exhausted')
    throw new Error('No session found. The authentication link may have expired or already been used.')
    
  } catch (err: any) {
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
