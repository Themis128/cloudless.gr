<template>
  <v-container fluid class="fill-height login-container">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="login-card">
          <div class="text-center mb-8">
            <h1 class="text-h4 font-weight-bold text-white">Welcome to Cloudless</h1>
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
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
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
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
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
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
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
          </v-form>

          <!-- Social Auth -->
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
            >
              Continue with GitHub
            </v-btn>
          </div>

          <!-- Error Display -->
          <v-alert
            v-if="error"
            type="error"
            class="mt-4"
            closable
            @click:close="error = ''"
          >
            {{ error }}
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
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

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

// Redirect if already logged in
watchEffect(() => {
  if (user.value) {
    router.push('/dashboard')
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

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (signInError) {
      error.value = signInError.message
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

  isLoading.value = true
  error.value = ''

  try {
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: magicEmail.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (magicError) {
      error.value = magicError.message
    } else {
      successMessage.value = 'Magic link sent! Check your email.'
      showMagicLink.value = false
    }
  } catch (err) {
    error.value = 'Failed to send magic link'
    console.error('Magic link error:', err)
  } finally {
    isLoading.value = false
  }
}

// Google OAuth
const handleGoogleLogin = async () => {
  socialLoading.value = 'google'
  error.value = ''

  try {
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (googleError) {
      error.value = googleError.message
    }
  } catch (err) {
    error.value = 'Failed to sign in with Google'
    console.error('Google login error:', err)
  } finally {
    socialLoading.value = ''
  }
}

// GitHub OAuth
const handleGitHubLogin = async () => {
  socialLoading.value = 'github'
  error.value = ''

  try {
    const { error: githubError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (githubError) {
      error.value = githubError.message
    }
  } catch (err) {
    error.value = 'Failed to sign in with GitHub'
    console.error('GitHub login error:', err)
  } finally {
    socialLoading.value = ''
  }
}
</script>

<style scoped>
.login-container {
  position: relative;
  z-index: 1;
}

.login-card {
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2rem;
}

:deep(.login-field) {
  .v-field__overlay {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .v-field__field {
    color: white !important;
  }

  .v-label {
    color: rgba(255, 255, 255, 0.7);
  }

  input {
    color: white !important;
  }

  .v-field {
    border-color: rgba(255, 255, 255, 0.2);
  }
}

:deep(.v-btn) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

:deep(.v-alert) {
  background: rgba(244, 67, 54, 0.1) !important;
  color: white;
  border: 1px solid rgba(244, 67, 54, 0.2);
}
</style>
