<template>  <v-container fluid class="d-flex flex-column justify-center align-center min-height-screen pa-4">
    <div class="w-100" style="max-width: 400px;">      <!-- Logo/Brand Section -->
      <div class="text-center mb-8">
        <h1 class="text-h3 font-weight-bold text-white mb-2">Cloudless</h1>
        <p class="text-body-1 text-white">Welcome back! Please sign in to continue.</p>
      </div><v-card class="login-card" elevation="24">        <v-card-title class="text-center pb-2 pt-8">
          <div class="login-header">
            <div class="login-icon-wrapper mb-4">
              <div class="icon-background">
                <v-icon size="48" color="primary" class="login-icon">mdi-shield-account</v-icon>
              </div>
            </div>
            <h2 class="text-h4 font-weight-bold mb-2 primary--text">Welcome Back</h2>
            <p class="text-body-1 text-medium-emphasis mb-0">Sign in to access your workspace</p>
          </div>
        </v-card-title><v-card-text class="pa-8">
          <v-form @submit.prevent="handleLogin" class="login-form">            <div class="form-section mb-6">
              <v-text-field
                v-model="email"
                label="Email Address"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                class="mb-4 elevated-input"
                required
                :error-messages="emailErrors"
                @blur="validateEmail"
                hide-details="auto"
                density="comfortable"
              />
              <v-text-field
                v-model="password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                variant="outlined"
                class="mb-6 elevated-input"
                required
                :error-messages="passwordErrors"
                @blur="validatePassword"
                hide-details="auto"
                density="comfortable"
              />
            </div>

            <v-btn 
              type="submit" 
              block 
              color="primary" 
              size="x-large"
              :loading="loading" 
              class="mb-6 login-btn gradient-btn"
              :disabled="!isFormValid"
              elevation="4"
            >
              <v-icon left size="20">mdi-login-variant</v-icon>
              <span class="mx-2">Sign In to Account</span>
            </v-btn>
          </v-form>          <v-divider class="my-8">
            <span class="divider-text text-body-2 text-medium-emphasis pa-4">or continue with</span>
          </v-divider>

          <!-- Social Login Buttons -->
          <div class="social-login-section mb-6">            <v-btn 
              block 
              variant="outlined" 
              size="large"
              @click="loginWith('google')" 
              :loading="loading"
              class="social-btn google-btn mb-3"
              elevation="2"
            >
              <v-icon left color="#4285F4" size="20">mdi-google</v-icon>
              <span class="mx-2">Continue with Google</span>
            </v-btn>
            <v-btn 
              block 
              variant="outlined" 
              size="large"
              @click="loginWith('github')" 
              :loading="loading"
              class="social-btn github-btn"
              elevation="2"
            >
              <v-icon left size="20">mdi-github</v-icon>
              <span class="mx-2">Continue with GitHub</span>
            </v-btn>
          </div>

          <v-divider class="my-8" />

          <!-- Magic Link Section -->
          <div class="magic-link-section mb-6">
            <v-btn 
              block 
              variant="text" 
              color="primary"
              size="large"
              @click="handleMagicLink" 
              :loading="loading"
              :disabled="!email || !isValidEmail(email)"
              class="magic-link-btn"
            >
              <v-icon left size="20">mdi-email-fast-outline</v-icon>
              <span class="mx-2">Send Magic Link</span>
            </v-btn>
          </div>          <!-- Error Alert -->
          <v-alert 
            v-if="error" 
            :type="error.startsWith('✅') ? 'success' : 'error'" 
            class="mt-6 alert-enhanced" 
            closable 
            @click:close="error = ''"
            variant="tonal"
            border="start"
            elevation="2"
          >
            {{ error }}
          </v-alert>
        </v-card-text>        <v-card-actions class="pa-8 pt-2">
          <div class="w-100 text-center">
            <p class="text-body-1 text-medium-emphasis">
              Don't have an account? 
              <NuxtLink to="/auth/register" class="register-link text-primary text-decoration-none font-weight-bold">
                Create one here
              </NuxtLink>
            </p>
          </div>
        </v-card-actions>
      </v-card>
    </div>  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  public: true,
})

const router = useRouter()
const route = useRoute()
const supabase = useSupabaseClient()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)
const emailErrors = ref<string[]>([])
const passwordErrors = ref<string[]>([])

const redirectPath = computed(() => route.query.redirect as string || '/dashboard')

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isFormValid = computed(() => {
  return email.value && password.value && isValidEmail(email.value) && password.value.length >= 6
})

const validateEmail = () => {
  emailErrors.value = []
  if (!email.value) {
    emailErrors.value.push('Email is required')
  } else if (!isValidEmail(email.value)) {
    emailErrors.value.push('Please enter a valid email address')
  }
}

const validatePassword = () => {
  passwordErrors.value = []
  if (!password.value) {
    passwordErrors.value.push('Password is required')
  } else if (password.value.length < 6) {
    passwordErrors.value.push('Password must be at least 6 characters')
  }
}

watchEffect(async () => {
  const session = await $fetch('/api/auth/session')
  if (session?.authenticated) router.push(redirectPath.value)
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{
      success: boolean
      message: string
      user?: any
      token?: string
      expiresAt?: string
    }>('/api/auth/user-login', {
      method: 'POST',
      body: { 
        email: email.value, 
        password: password.value,
        rememberMe: false
      },
    })

    if (res && res.success) {
      // Store the authentication data
      if (res.token) {
        localStorage.setItem('auth_token', res.token)
        localStorage.setItem('auth_user', JSON.stringify(res.user))
      }
      
      // Show success message briefly before redirect
      error.value = '✅ Login successful! Redirecting...'
      
      setTimeout(() => {
        router.push(redirectPath.value)
      }, 1500)
    } else {
      error.value = res?.message || 'Login failed'
    }
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || 'Unexpected login error'
  } finally {
    loading.value = false
  }
}

const handleMagicLink = async () => {
  loading.value = true
  error.value = ''
  try {
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (magicError) throw new Error(magicError.message)

    error.value = '✅ Magic link sent! Check your inbox.'
  } catch (err: any) {
    error.value = err.message || 'Failed to send magic link'
  } finally {
    loading.value = false
  }
}

const loginWith = async (provider: 'google' | 'github') => {
  loading.value = true
  error.value = ''
  try {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) throw new Error(oauthError.message)
  } catch (err: any) {
    error.value = err.message || `OAuth login with ${provider} failed`
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-card {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px !important;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.12), 
              0 20px 40px rgba(0, 0, 0, 0.08),
              0 15px 25px rgba(0, 0, 0, 0.06) !important;
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
}

.dark .login-card {
  background: rgba(20, 25, 35, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25), 
              0 20px 40px rgba(0, 0, 0, 0.15),
              0 15px 25px rgba(0, 0, 0, 0.1) !important;
}

.dark .login-card::before {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
}

/* Header styling */
.login-header {
  position: relative;
}

.icon-background {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.icon-background::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transform: rotate(45deg);
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
  50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}

.dark .icon-background {
  background: linear-gradient(135deg, #4c63d2 0%, #5a4b9d 100%);
  box-shadow: 0 8px 25px rgba(76, 99, 210, 0.4);
}

/* Button styling */
.gradient-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  border-radius: 16px !important;
  text-transform: none !important;
  font-weight: 700 !important;
  letter-spacing: 0.5px !important;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.35) !important;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
  position: relative;
  overflow: hidden;
}

.gradient-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.gradient-btn:hover::before {
  left: 100%;
}

.gradient-btn:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 35px rgba(102, 126, 234, 0.45) !important;
}

.gradient-btn:active {
  transform: translateY(-1px) scale(0.98);
}

.dark .gradient-btn {
  background: linear-gradient(135deg, #4c63d2 0%, #5a4b9d 100%) !important;
  box-shadow: 0 8px 25px rgba(76, 99, 210, 0.4) !important;
}

.dark .gradient-btn:hover {
  box-shadow: 0 12px 35px rgba(76, 99, 210, 0.5) !important;
}

/* Social button styling */
.social-btn {
  border-radius: 14px !important;
  text-transform: none !important;
  font-weight: 600 !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  border: 2px solid rgba(0, 0, 0, 0.08) !important;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.social-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.6s;
}

.social-btn:hover::before {
  left: 100%;
}

.google-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(66, 133, 244, 0.3) !important;
  border-color: #4285F4 !important;
  background: rgba(66, 133, 244, 0.05) !important;
}

.github-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(36, 41, 47, 0.3) !important;
  border-color: #24292f !important;
  background: rgba(36, 41, 47, 0.05) !important;
}

.dark .social-btn {
  border: 2px solid rgba(255, 255, 255, 0.15) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.dark .google-btn:hover {
  border-color: #4285F4 !important;
  background: rgba(66, 133, 244, 0.15) !important;
}

.dark .github-btn:hover {
  border-color: #f0f6fc !important;
  background: rgba(240, 246, 252, 0.15) !important;
}

/* Input field styling */
.elevated-input :deep(.v-field) {
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  background: rgba(255, 255, 255, 0.7) !important;
  border-radius: 14px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.dark .elevated-input :deep(.v-field) {
  background: rgba(255, 255, 255, 0.08) !important;
}

.elevated-input :deep(.v-field--focused) {
  background: rgba(255, 255, 255, 0.9) !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2) !important;
  transform: translateY(-2px);
}

.dark .elevated-input :deep(.v-field--focused) {
  background: rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 0 0 3px rgba(76, 99, 210, 0.3) !important;
}

.elevated-input :deep(.v-field--variant-outlined .v-field__outline) {
  border-color: rgba(102, 126, 234, 0.2) !important;
  border-width: 2px !important;
}

.elevated-input :deep(.v-field--variant-outlined.v-field--focused .v-field__outline) {
  border-color: #667eea !important;
  border-width: 2px !important;
}

/* Magic link button */
.magic-link-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 600 !important;
  transition: all 0.3s ease !important;
  background: rgba(102, 126, 234, 0.1) !important;
}

.magic-link-btn:hover {
  background: rgba(102, 126, 234, 0.2) !important;
  transform: translateY(-1px);
}

.dark .magic-link-btn {
  background: rgba(76, 99, 210, 0.15) !important;
}

.dark .magic-link-btn:hover {
  background: rgba(76, 99, 210, 0.25) !important;
}

/* Divider styling */
.divider-text {
  background: rgba(255, 255, 255, 0.9);
  padding: 0 16px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.dark .divider-text {
  background: rgba(20, 25, 35, 0.9);
}

/* Alert styling */
.alert-enhanced {
  border-radius: 14px !important;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-left: 4px solid currentColor !important;
}

/* Link styling */
.register-link {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  position: relative;
}

.register-link::after {
  content: '';
  position: absolute;
  width: 0;
  height: 2px;
  bottom: -2px;
  left: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.register-link:hover::after {
  width: 100%;
}

.register-link:hover {
  transform: translateY(-1px);
}

/* Form section spacing */
.form-section {
  position: relative;
}

.social-login-section {
  position: relative;
}

.magic-link-section {
  position: relative;
}
</style>
