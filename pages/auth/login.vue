<template>
  <div class="login-page-root">
    <!-- Fixed Logo -->
    <div class="login-logo-fixed">
      <NuxtLink to="/">
        <img src="/logo.svg" alt="Cloudless Logo" height="48" />
      </NuxtLink>
    </div>

    <!-- Centered Login Form -->
    <div class="login-center-wrapper d-flex align-center justify-center fill-height">
      <v-row class="w-100" align="center" justify="center">
        <v-col cols="12" sm="8" md="6" lg="4">
          <v-card class="login-card">
            <div class="text-center mb-8">
              <h1 class="text-h4 font-weight-bold">Welcome to Cloudless</h1>
              <p class="text-body-1 text-medium-emphasis">Sign in to your account</p>
            </div>

            <!-- Email/Password Login -->
            <v-form @submit.prevent="handleEmailLogin" v-if="!showMagicLink">
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                required
                :error-messages="emailError"
                @input="emailError = ''"
                variant="outlined"
                bg-color="rgba(0, 0, 0, 0.04)"
                color="black"
                class="login-field"
              />

              <v-text-field
                v-model="password"
                label="Password"
                type="password"
                required
                :error-messages="passwordError"
                @input="passwordError = ''"
                variant="outlined"
                bg-color="rgba(0, 0, 0, 0.04)"
                color="black"
                class="login-field mb-4"
              />

              <v-btn
                type="submit"
                block
                size="large"
                :loading="isLoading"
                class="mb-4"
              >
                Sign In
              </v-btn>

              <v-divider class="my-4" />

              <v-btn
                @click="showMagicLink = true"
                variant="outlined"
                block
                size="large"
                class="mb-4"
              >
                Sign in with Magic Link
              </v-btn>
            </v-form>

            <!-- Magic Link Form -->
            <v-form @submit.prevent="handleMagicLink" v-else>
              <v-text-field
                v-model="magicEmail"
                label="Email"
                type="email"
                required
                :error-messages="emailError"
                @input="emailError = ''"
                variant="outlined"
                bg-color="rgba(0, 0, 0, 0.04)"
                color="black"
                class="login-field"
                hint="We'll send you a secure login link"
              />

              <v-btn
                type="submit"
                block
                size="large"
                :loading="isLoading"
                class="mb-4"
              >
                Send Magic Link
              </v-btn>

              <v-btn
                @click="showMagicLink = false"
                variant="text"
                block
                size="large"
              >
                Back to Password Login
              </v-btn>
            </v-form>            <!-- Social Auth -->
            <v-divider class="my-6" />
            
            <div class="text-center mb-4">
              <p class="text-body-2 text-medium-emphasis">Or continue with</p>
            </div>

            <div class="d-flex flex-column gap-3">
              <v-btn
                @click="handleGoogleLogin"
                variant="outlined"
                block
                size="large"
                prepend-icon="mdi-google"
                :loading="socialLoading === 'google'"
                :disabled="socialLoading !== ''"
              >
                Continue with Google
              </v-btn>

              <v-btn
                @click="handleGitHubLogin"
                variant="outlined"
                block
                size="large"
                prepend-icon="mdi-github"
                :loading="socialLoading === 'github'"
                :disabled="socialLoading !== ''"
              >
                Continue with GitHub
              </v-btn>
            </div>

            <!-- OAuth Help Text -->
            <div v-if="socialLoading" class="text-center mt-3">
              <p class="text-caption text-medium-emphasis">
                <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
                If a popup doesn't appear, please check your browser's popup blocker settings.
              </p>
            </div><!-- Error Display -->
            <v-alert
              v-if="error"
              type="error"
              class="mt-4"
              closable
              @click:close="error = ''"
            >
              {{ error }}
              
              <!-- Show resend confirmation option for unconfirmed emails or expired OTP -->
              <div v-if="(error.includes('confirm') || error.includes('expired') || error.includes('invalid') || error.includes('link')) && email" class="mt-3">
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  @click="resendConfirmation"
                  :loading="resendLoading"
                  prepend-icon="mdi-email-send"
                >
                  Resend Confirmation Email
                </v-btn>
              </div>
              
              <!-- Show resend option for expired OTP even without email entered -->
              <div v-else-if="(error.includes('expired') || error.includes('invalid') || error.includes('link')) && !email" class="mt-3">
                <p class="text-caption mb-2 text-white">Please enter your email address first:</p>
                <v-text-field
                  v-model="email"
                  label="Email"
                  type="email"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="mb-2"
                  bg-color="rgba(255, 255, 255, 0.9)"
                />
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  @click="resendConfirmation"
                  :loading="resendLoading"
                  prepend-icon="mdi-email-send"
                  :disabled="!email"
                >
                  Resend Confirmation Email
                </v-btn>
              </div>
              
              <!-- Show additional help for persistent issues -->
              <div v-if="error.includes('contact support')" class="mt-3">
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  href="/contact"
                  prepend-icon="mdi-help-circle"
                >
                  Contact Support
                </v-btn>
              </div>
            </v-alert>

            <!-- Success Message -->
            <v-alert
              v-if="successMessage"
              type="success"
              class="mt-4"
              closable
              @click:close="successMessage = ''"
            >
              {{ successMessage }}
            </v-alert>

            <!-- Sign Up Link -->
            <div class="text-center mt-6">
              <p class="text-body-2 text-medium-emphasis">
                Don't have an account?
                <NuxtLink to="/auth/signup" class="text-primary">
                  Sign up here
                </NuxtLink>
              </p>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Transparent Footer -->
    <v-footer class="footer-transparent mt-8" app>
      <v-container>
        <v-row justify="center">
          <v-col cols="12" class="text-center">
            <span class="footer-dark-text text-body-2">&copy; {{ new Date().getFullYear() }} Cloudless.gr</span>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  public: true  // Login page should be accessible to everyone
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()
const route = useRoute()

// Reactive state
const email = ref('')
const password = ref('')
const magicEmail = ref('')
const emailError = ref('')
const passwordError = ref('')
const error = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const socialLoading = ref('')
const showMagicLink = ref(false)
const resendLoading = ref(false)

// Redirect if already logged in
watchEffect(() => {
  if (user.value) {
    router.push('/dashboard')
  }
})

// Check for URL errors on page load
onMounted(() => {
  const urlError = route.query.error as string
  const errorCode = route.query.error_code as string
  const errorDescription = route.query.error_description as string
  const authError = route.query.auth_error as string
  
  // Try to extract email from URL parameters if available
  const urlEmail = route.query.email as string
  if (urlEmail && !email.value) {
    email.value = urlEmail
  }

  if (urlError || authError) {
    if (errorCode === 'otp_expired' || authError === 'otp_expired' || errorDescription?.includes('expired')) {
      error.value = 'Your email confirmation link has expired. Please request a new one below.'
      // If we have an email, pre-fill it to make resending easier
      if (urlEmail && !email.value) {
        email.value = urlEmail
      }
    } else if (errorCode === 'otp_invalid' || errorDescription?.includes('invalid')) {
      error.value = 'The confirmation link is invalid or has already been used. Please request a new one if needed.'
    } else if (errorCode === 'access_denied') {
      error.value = 'Access denied. Please try signing in again.'
    } else if (errorDescription) {
      error.value = decodeURIComponent(errorDescription).replace(/\+/g, ' ')
    } else {
      error.value = 'Authentication failed. Please try again.'
    }
    
    // Clean up URL without these error parameters but preserve email if present
    const cleanQuery: Record<string, string> = {}
    if (urlEmail) {
      cleanQuery.email = urlEmail
    }
    router.replace({ path: '/auth/login', query: Object.keys(cleanQuery).length > 0 ? cleanQuery : undefined })
  }
})

// Email/Password Login
const handleEmailLogin = async () => {
  if (!email.value || !password.value) {
    if (!email.value) emailError.value = 'Email is required'
    if (!password.value) passwordError.value = 'Password is required'
    return
  }

  isLoading.value = true
  error.value = ''
  try {    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (signInError) {
      console.log('Sign in error:', signInError)
      
      // Handle specific error cases
      if (signInError.message.includes('Invalid login credentials')) {
        error.value = 'Invalid email or password. If you just signed up, please check your email and confirm your account first.'
      } else if (signInError.message.includes('Email not confirmed') || signInError.message.includes('confirm')) {
        error.value = 'Please check your email and click the confirmation link before signing in.'
      } else if (signInError.message.includes('signup') || signInError.message.includes('registration')) {
        error.value = 'There was an issue with your account setup. Please try resending the confirmation email.'
      } else if (signInError.message.includes('rate limit')) {
        error.value = 'Too many login attempts. Please wait a moment before trying again.'
      } else {
        error.value = signInError.message
      }
    } else {
      // Success - user will be automatically redirected by watchEffect
      successMessage.value = 'Successfully signed in!'
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Login error:', err)
  } finally {
    isLoading.value = false
  }
}

// Magic Link Login
const handleMagicLink = async () => {
  if (!magicEmail.value) {
    emailError.value = 'Email is required'
    return
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(magicEmail.value)) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  isLoading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: magicEmail.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?type=magiclink`,
        shouldCreateUser: true,
        data: {
          email: magicEmail.value,
          provider: 'magic_link',
          created_at: new Date().toISOString()
        }
      }
    })

    if (magicError) {
      console.error('Magic link error:', magicError)
      
      // Handle specific error cases
      if (magicError.message.includes('rate limit') || magicError.message.includes('too many')) {
        error.value = 'Too many requests. Please wait a moment before requesting another magic link.'
      } else if (magicError.message.includes('invalid email') || magicError.message.includes('email')) {
        error.value = 'Please enter a valid email address.'
      } else if (magicError.message.includes('signup disabled') || magicError.message.includes('not enabled')) {
        error.value = 'Magic link signup is currently disabled. Please try password login or contact support.'
      } else {
        error.value = `Failed to send magic link: ${magicError.message}`
      }
    } else {
      successMessage.value = `Magic link sent to ${magicEmail.value}! Check your email and spam folder. The link will expire in 1 hour.`
      showMagicLink.value = false
      
      // Auto-clear success message after 10 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 10000)
      
      console.log('✅ Magic link sent successfully to:', magicEmail.value)
    }
  } catch (err: any) {
    console.error('Magic link error:', err)
    
    if (err.name === 'NetworkError' || err.message.includes('fetch')) {
      error.value = 'Network error. Please check your internet connection and try again.'
    } else if (err.message.includes('timeout')) {
      error.value = 'Request timed out. Please try again in a moment.'
    } else {
      error.value = 'Failed to send magic link. Please try again or use password login.'
    }
  } finally {
    isLoading.value = false
  }
}

// Google OAuth
const handleGoogleLogin = async () => {
  socialLoading.value = 'google'
  error.value = ''
  successMessage.value = ''

  try {
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?type=oauth&provider=google`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        },
        scopes: 'email profile'
      }
    })

    if (googleError) {
      console.error('Google login error:', googleError)
      
      // Handle specific Google OAuth errors
      if (googleError.message.includes('popup') || googleError.message.includes('blocked')) {
        error.value = 'Popup was blocked. Please allow popups for this site and try again.'
      } else if (googleError.message.includes('network') || googleError.message.includes('offline')) {
        error.value = 'Network error. Please check your internet connection and try again.'
      } else if (googleError.message.includes('not enabled') || googleError.message.includes('disabled')) {
        error.value = 'Google sign-in is currently disabled. Please try password login or contact support.'
      } else if (googleError.message.includes('unauthorized') || googleError.message.includes('permission')) {
        error.value = 'Google sign-in access is restricted. Please contact support.'
      } else {
        error.value = `Google sign-in failed: ${googleError.message}`
      }
    } else {
      // OAuth redirect will happen automatically
      console.log('✅ Google OAuth initiated successfully')
    }
  } catch (err: any) {
    console.error('Google login error:', err)
    
    if (err.name === 'NetworkError' || err.message.includes('fetch')) {
      error.value = 'Network error. Please check your internet connection and try again.'
    } else if (err.message.includes('timeout')) {
      error.value = 'Request timed out. Please try again in a moment.'
    } else {
      error.value = 'Failed to sign in with Google. Please try password login or contact support.'
    }
  } finally {
    socialLoading.value = ''
  }
}

// GitHub OAuth
const handleGitHubLogin = async () => {
  socialLoading.value = 'github'
  error.value = ''
  successMessage.value = ''

  try {
    const { error: githubError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?type=oauth&provider=github`,
        scopes: 'read:user user:email'
      }
    })

    if (githubError) {
      console.error('GitHub login error:', githubError)
      
      // Handle specific GitHub OAuth errors
      if (githubError.message.includes('popup') || githubError.message.includes('blocked')) {
        error.value = 'Popup was blocked. Please allow popups for this site and try again.'
      } else if (githubError.message.includes('network') || githubError.message.includes('offline')) {
        error.value = 'Network error. Please check your internet connection and try again.'
      } else if (githubError.message.includes('not enabled') || githubError.message.includes('disabled')) {
        error.value = 'GitHub sign-in is currently disabled. Please try password login or contact support.'
      } else if (githubError.message.includes('unauthorized') || githubError.message.includes('permission')) {
        error.value = 'GitHub sign-in access is restricted. Please contact support.'
      } else {
        error.value = `GitHub sign-in failed: ${githubError.message}`
      }
    } else {
      // OAuth redirect will happen automatically
      console.log('✅ GitHub OAuth initiated successfully')
    }
  } catch (err: any) {
    console.error('GitHub login error:', err)
    
    if (err.name === 'NetworkError' || err.message.includes('fetch')) {
      error.value = 'Network error. Please check your internet connection and try again.'
    } else if (err.message.includes('timeout')) {
      error.value = 'Request timed out. Please try again in a moment.'
    } else {
      error.value = 'Failed to sign in with GitHub. Please try password login or contact support.'
    }
  } finally {
    socialLoading.value = ''
  }
}

// Resend email confirmation with enhanced OTP handling
const resendConfirmation = async () => {
  if (!email.value) {
    error.value = 'Please enter your email address first'
    return
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    error.value = 'Please enter a valid email address'
    return
  }

  resendLoading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    // First, try to resend the signup confirmation
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (resendError) {
      console.log('Resend error:', resendError)
      
      // Handle specific resend errors
      if (resendError.message.includes('rate limit') || resendError.message.includes('too many')) {
        error.value = 'Please wait a moment before requesting another confirmation email. Try again in 1-2 minutes.'
      } else if (resendError.message.includes('already confirmed') || resendError.message.includes('email already confirmed')) {
        error.value = 'Your email is already confirmed. You can sign in normally with your password.'
        // Clear the OTP expired error since account is confirmed
        successMessage.value = 'Your account is already confirmed! Please try signing in.'
      } else if (resendError.message.includes('User not found') || resendError.message.includes('No user found')) {
        // If user doesn't exist, suggest they sign up first
        error.value = 'No account found with this email. Please sign up first or check if you\'re using the correct email address.'
      } else if (resendError.message.includes('signup disabled') || resendError.message.includes('not enabled')) {
        error.value = 'Email signup is currently disabled. Please contact support or try an alternative sign-in method.'
      } else {
        // For other errors, show the original message but add helpful context
        error.value = `${resendError.message}. If this persists, please contact support.`
      }
    } else {
      // Success case
      successMessage.value = 'Confirmation email resent successfully! Please check your inbox and spam folder. The new link will expire in 24 hours.'
      error.value = ''
      
      // Auto-clear success message after 10 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 10000)
      
      console.log('✅ Confirmation email resent successfully')
    }
  } catch (err: any) {
    console.error('Resend confirmation error:', err)
    
    // Handle network or unexpected errors
    if (err.name === 'NetworkError' || err.message.includes('fetch')) {
      error.value = 'Network error. Please check your internet connection and try again.'
    } else if (err.message.includes('timeout')) {
      error.value = 'Request timed out. Please try again in a moment.'
    } else {
      error.value = 'Failed to resend confirmation email. Please try again or contact support if the issue persists.'
    }
  } finally {
    resendLoading.value = false
  }
}
</script>

<style scoped>
.login-page-root {
  min-height: 100vh;
  width: 100vw;
  position: relative;
  background: transparent !important;
}

.login-center-wrapper {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.header-transparent {
  display: none;
}

.login-logo-fixed {
  position: fixed;
  top: 32px;
  left: 32px;
  z-index: 10;
}

.login-logo-fixed img {
  height: 48px;
  max-width: 180px;
  display: block;
}

.login-card {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  padding: 2rem;
}

.footer-transparent {
  background: transparent !important;
  color: #222 !important;
  border: none !important;
  backdrop-filter: none !important;
  position: relative;
  z-index: 2;
}

.footer-dark-text {
  color: #222 !important;
}

:deep(.login-field) {
  .v-field__overlay {
    background-color: rgba(0, 0, 0, 0.04);
  }
  .v-field__field {
    color: #222 !important;
    letter-spacing: 0.01em;
  }
  .v-label {
    color: #444 !important;
    font-weight: 500;
  }
  input {
    color: #222 !important;
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .v-field {
    border-color: #d1d5db;
  }
}

:deep(.v-btn) {
  background: rgba(0, 0, 0, 0.06);
  border: 1px solid #d1d5db;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  color: #222 !important;
  font-weight: 600;
}

:deep(.v-alert) {
  background: rgba(244, 67, 54, 0.08) !important;
  color: #b71c1c;
  border: 1px solid rgba(244, 67, 54, 0.18);
}

.text-white {
  color: #222 !important;
}

.text-body-1, .text-body-2, .text-medium-emphasis {
  color: #444 !important;
  font-weight: 500;
}
</style>
