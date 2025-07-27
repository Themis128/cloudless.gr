<template>
  <div class="login-form-container">
    <div class="login-form-card">
      <div class="login-header">
        <div class="logo-section">
          <div class="logo-container">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="logo"
            >
              <rect width="48" height="48" rx="12" fill="#23232b" />
              <circle cx="24" cy="24" r="14" fill="#fff" />
              <text
                x="24"
                y="28"
                text-anchor="middle"
                font-size="14"
                font-weight="700"
                fill="#23232b"
                font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                CL
              </text>
            </svg>
          </div>
          <h1 class="login-title">Welcome Back</h1>
          <p class="login-subtitle">Sign in to your Cloudless Wizard account</p>
        </div>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email" class="form-label">Email Address</label>
          <div class="input-wrapper">
            <v-icon class="input-icon">mdi-email</v-icon>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              class="form-input"
              placeholder="Enter your email"
              :disabled="isLoading"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <div class="input-wrapper">
            <v-icon class="input-icon">mdi-lock</v-icon>
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              class="form-input"
              placeholder="Enter your password"
              :disabled="isLoading"
            />
            <button
              type="button"
              class="password-toggle"
              @click="showPassword = !showPassword"
              :disabled="isLoading"
            >
              <v-icon>{{ showPassword ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
            </button>
          </div>
        </div>

        <div class="form-options">
          <label class="remember-me">
            <input
              v-model="form.rememberMe"
              type="checkbox"
              class="checkbox"
              :disabled="isLoading"
            />
            <span class="checkbox-label">Remember me</span>
          </label>
          <NuxtLink to="/forgot-password" class="forgot-password">
            Forgot password?
          </NuxtLink>
        </div>

        <div v-if="error" class="error-message">
          <v-icon color="error">mdi-alert-circle</v-icon>
          <span>{{ error }}</span>
        </div>

        <button
          type="submit"
          class="login-button"
          :disabled="isLoading || !isFormValid"
        >
          <v-icon v-if="isLoading" class="loading-icon">mdi-loading</v-icon>
          <span>{{ isLoading ? 'Signing in...' : 'Sign In' }}</span>
        </button>

        <div class="divider">
          <span>or</span>
        </div>

        <div class="social-login">
          <button
            type="button"
            class="social-button google"
            @click="handleGoogleLogin"
          >
            <v-icon>mdi-google</v-icon>
            <span>Continue with Google</span>
          </button>
          <button
            type="button"
            class="social-button github"
            @click="handleGithubLogin"
          >
            <v-icon>mdi-github</v-icon>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div class="register-link">
          <span>Don't have an account?</span>
          <NuxtLink to="/register" class="link">Sign up</NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

interface LoginForm {
  email: string
  password: string
  rememberMe: boolean
}

const emit = defineEmits<{
  success: [user: any]
  error: [error: string]
}>()

// Form state
const form = ref<LoginForm>({
  email: '',
  password: '',
  rememberMe: false,
})

const showPassword = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Auth store
const authStore = useAuthStore()

// Computed
const isFormValid = computed(() => {
  return (
    form.value.email && form.value.password && form.value.email.includes('@')
  )
})

// Methods
const handleLogin = async () => {
  if (!isFormValid.value) return

  try {
    isLoading.value = true
    error.value = null

    const result = await authStore.login({
      email: form.value.email,
      password: form.value.password,
    })

    if (result.success) {
      emit('success', result.user)
      // Navigation will be handled by the parent component
    } else {
      error.value = result.error || 'Login failed'
      emit('error', error.value)
    }
  } catch (err: any) {
    console.error('💥 Login error:', err)
    error.value = err.message || 'An unexpected error occurred'
    emit('error', error.value)
  } finally {
    isLoading.value = false
  }
}

const handleGoogleLogin = async () => {
  try {
    isLoading.value = true
    error.value = null

    // Implement Google OAuth login
    console.log('Google login not implemented yet')
    error.value = 'Google login not implemented yet'
  } catch (err: any) {
    console.error('Google login error:', err)
    error.value = err.message || 'Google login failed'
  } finally {
    isLoading.value = false
  }
}

const handleGithubLogin = async () => {
  try {
    isLoading.value = true
    error.value = null

    // Implement GitHub OAuth login
    console.log('GitHub login not implemented yet')
    error.value = 'GitHub login not implemented yet'
  } catch (err: any) {
    console.error('GitHub login error:', err)
    error.value = err.message || 'GitHub login failed'
  } finally {
    isLoading.value = false
  }
}

// Initialize form with stored email if available
onMounted(() => {
  if (process.client) {
    const storedEmail = localStorage.getItem('remembered_email')
    if (storedEmail) {
      form.value.email = storedEmail
      form.value.rememberMe = true
    }
  }
})

// Watch for remember me changes
watch(
  () => form.value.rememberMe,
  remember => {
    if (process.client) {
      if (remember && form.value.email) {
        localStorage.setItem('remembered_email', form.value.email)
      } else {
        localStorage.removeItem('remembered_email')
      }
    }
  }
)

// Watch for email changes when remember me is checked
watch(
  () => form.value.email,
  email => {
    if (process.client && form.value.rememberMe && email) {
      localStorage.setItem('remembered_email', email)
    }
  }
)
</script>

<style scoped>
.login-form-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.01) 0%,
    rgba(248, 250, 252, 0.01) 100%
  );
  backdrop-filter: blur(6.5px);
}

.login-form-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 2.5rem;
  width: 100%;
  max-width: 480px;
  position: relative;
  overflow: hidden;
}

.login-form-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.logo {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0;
  font-weight: 500;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 1rem;
  color: #9ca3af;
  z-index: 1;
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: rgba(255, 255, 255, 0.95);
}

.form-input:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.password-toggle {
  position: absolute;
  right: 1rem;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: #667eea;
}

.password-toggle:disabled {
  color: #d1d5db;
  cursor: not-allowed;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
}

.checkbox-label {
  color: #374151;
  font-weight: 500;
}

.forgot-password {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.forgot-password:hover {
  color: #5a67d8;
  text-decoration: underline;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
}

.login-button {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
}

.login-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: left 0.5s ease;
}

.login-button:hover::before {
  left: 100%;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.login-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  font-weight: 500;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e5e7eb;
}

.divider span {
  padding: 0 1rem;
  background: rgba(255, 255, 255, 0.95);
}

.social-login {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.social-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
  color: #374151;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.social-button:hover {
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.social-button.google:hover {
  border-color: #ea4335;
  color: #ea4335;
}

.social-button.github:hover {
  border-color: #333;
  color: #333;
}

.register-link {
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.register-link .link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  margin-left: 0.25rem;
  transition: color 0.2s ease;
}

.register-link .link:hover {
  color: #5a67d8;
  text-decoration: underline;
}

@media (max-width: 640px) {
  .login-form-container {
    padding: 1rem;
  }

  .login-form-card {
    padding: 2rem 1.5rem;
  }

  .login-title {
    font-size: 1.75rem;
  }

  .social-login {
    gap: 0.5rem;
  }

  .social-button {
    padding: 0.625rem 1rem;
    font-size: 0.8rem;
  }
}
</style>
