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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
        data: {
          email: magicEmail.value,
          provider: 'magic_link'
        }
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
