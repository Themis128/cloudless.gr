<template>
  <div class="register-form-container">
    <div class="register-form-card">
      <div class="register-header">
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
              <rect
                width="48"
                height="48"
                rx="12"
                fill="#23232b"
              />
              <circle
                cx="24"
                cy="24"
                r="14"
                fill="#fff"
              />
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
          <h1 class="register-title">Create Account</h1>
          <p class="register-subtitle">Join Cloudless Wizard and start building</p>
        </div>
      </div>

      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label for="name" class="form-label">Full Name</label>
          <div class="input-wrapper">
            <v-icon class="input-icon">mdi-account</v-icon>
            <input
              id="name"
              v-model="form.name"
              type="text"
              required
              class="form-input"
              placeholder="Enter your full name"
              :disabled="isLoading"
            />
          </div>
        </div>

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
              placeholder="Create a strong password"
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
          <div class="password-strength" v-if="form.password">
            <div class="strength-bar">
              <div 
                class="strength-fill" 
                :class="passwordStrengthClass"
                :style="{ width: passwordStrength + '%' }"
              ></div>
            </div>
            <span class="strength-text" :class="passwordStrengthClass">
              {{ passwordStrengthText }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label for="confirmPassword" class="form-label">Confirm Password</label>
          <div class="input-wrapper">
            <v-icon class="input-icon">mdi-lock-check</v-icon>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              required
              class="form-input"
              placeholder="Confirm your password"
              :disabled="isLoading"
            />
            <button
              type="button"
              class="password-toggle"
              @click="showConfirmPassword = !showConfirmPassword"
              :disabled="isLoading"
            >
              <v-icon>{{ showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
            </button>
          </div>
          <div v-if="form.confirmPassword && !passwordsMatch" class="password-error">
            <v-icon color="error" size="small">mdi-alert-circle</v-icon>
            <span>Passwords do not match</span>
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-container">
            <input
              v-model="form.acceptTerms"
              type="checkbox"
              required
              class="checkbox"
              :disabled="isLoading"
            />
            <span class="checkbox-label">
              I agree to the 
              <NuxtLink to="/terms" class="link" target="_blank">Terms of Service</NuxtLink>
              and 
              <NuxtLink to="/privacy" class="link" target="_blank">Privacy Policy</NuxtLink>
            </span>
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-container">
            <input
              v-model="form.newsletter"
              type="checkbox"
              class="checkbox"
              :disabled="isLoading"
            />
            <span class="checkbox-label">
              Subscribe to our newsletter for updates and tips
            </span>
          </label>
        </div>

        <div v-if="error" class="error-message">
          <v-icon color="error">mdi-alert-circle</v-icon>
          <span>{{ error }}</span>
        </div>

        <button
          type="submit"
          class="register-button"
          :disabled="isLoading || !isFormValid"
        >
          <v-icon v-if="isLoading" class="loading-icon">mdi-loading</v-icon>
          <span>{{ isLoading ? 'Creating account...' : 'Create Account' }}</span>
        </button>

        <div class="divider">
          <span>or</span>
        </div>

        <div class="social-login">
          <button type="button" class="social-button google" @click="handleGoogleRegister">
            <v-icon>mdi-google</v-icon>
            <span>Continue with Google</span>
          </button>
          <button type="button" class="social-button github" @click="handleGithubRegister">
            <v-icon>mdi-github</v-icon>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div class="login-link">
          <span>Already have an account?</span>
          <NuxtLink to="/login" class="link">Sign in</NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
  newsletter: boolean
}

const emit = defineEmits<{
  success: [user: any]
  error: [error: string]
}>()

// Form state
const form = ref<RegisterForm>({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
  newsletter: false
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Auth store
const authStore = useAuthStore()

// Computed
const isFormValid = computed(() => {
  return form.value.name && 
         form.value.email && 
         form.value.email.includes('@') &&
         form.value.password && 
         form.value.confirmPassword &&
         passwordsMatch.value &&
         form.value.acceptTerms &&
         passwordStrength.value >= 60
})

const passwordsMatch = computed(() => {
  return form.value.password === form.value.confirmPassword
})

const passwordStrength = computed(() => {
  const password = form.value.password
  if (!password) return 0

  let strength = 0
  
  // Length check
  if (password.length >= 8) strength += 20
  if (password.length >= 12) strength += 10
  
  // Character variety checks
  if (/[a-z]/.test(password)) strength += 10
  if (/[A-Z]/.test(password)) strength += 10
  if (/[0-9]/.test(password)) strength += 10
  if (/[^A-Za-z0-9]/.test(password)) strength += 10
  
  // Complexity checks
  if (password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 10
  if (password.length >= 8 && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) strength += 10
  
  return Math.min(strength, 100)
})

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value < 40) return 'weak'
  if (passwordStrength.value < 70) return 'medium'
  return 'strong'
})

const passwordStrengthText = computed(() => {
  if (passwordStrength.value < 40) return 'Weak'
  if (passwordStrength.value < 70) return 'Medium'
  return 'Strong'
})

// Methods
const handleRegister = async () => {
  if (!isFormValid.value) return

  try {
    isLoading.value = true
    error.value = null

    const result = await authStore.register({
      name: form.value.name,
      email: form.value.email,
      password: form.value.password,
      confirmPassword: form.value.confirmPassword
    })

    if (result.success) {
      emit('success', authStore.user)
      
      // Redirect based on user role
      if (authStore.isAdmin) {
        await navigateTo('/admin/users')
      } else {
        await navigateTo('/dashboard')
      }
    } else {
      error.value = result.error || 'Registration failed'
      emit('error', error.value)
    }
  } catch (err: any) {
    console.error('Registration error:', err)
    error.value = err.message || 'An unexpected error occurred'
    emit('error', error.value)
  } finally {
    isLoading.value = false
  }
}

const handleGoogleRegister = async () => {
  try {
    isLoading.value = true
    error.value = null
    
    // Implement Google OAuth registration
    console.log('Google registration not implemented yet')
    error.value = 'Google registration not implemented yet'
  } catch (err: any) {
    console.error('Google registration error:', err)
    error.value = err.message || 'Google registration failed'
  } finally {
    isLoading.value = false
  }
}

const handleGithubRegister = async () => {
  try {
    isLoading.value = true
    error.value = null
    
    // Implement GitHub OAuth registration
    console.log('GitHub registration not implemented yet')
    error.value = 'GitHub registration not implemented yet'
  } catch (err: any) {
    console.error('GitHub registration error:', err)
    error.value = err.message || 'GitHub registration failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.register-form-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.01) 0%, rgba(248, 250, 252, 0.01) 100%);
  backdrop-filter: blur(6.5px);
}

.register-form-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 2.5rem;
  width: 100%;
  max-width: 520px;
  position: relative;
  overflow: hidden;
}

.register-form-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.register-header {
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

.register-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.register-subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0;
  font-weight: 500;
}

.register-form {
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

.password-strength {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
}

.strength-fill.weak {
  background: #ef4444;
}

.strength-fill.medium {
  background: #f59e0b;
}

.strength-fill.strong {
  background: #10b981;
}

.strength-text {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 50px;
}

.strength-text.weak {
  color: #ef4444;
}

.strength-text.medium {
  color: #f59e0b;
}

.strength-text.strong {
  color: #10b981;
}

.password-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ef4444;
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 0.5rem;
}

.checkbox-container {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1.4;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

.checkbox-label {
  color: #374151;
  font-weight: 500;
}

.checkbox-label .link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s ease;
}

.checkbox-label .link:hover {
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

.register-button {
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

.register-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.register-button:hover::before {
  left: 100%;
}

.register-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.register-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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

.login-link {
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.login-link .link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  margin-left: 0.25rem;
  transition: color 0.2s ease;
}

.login-link .link:hover {
  color: #5a67d8;
  text-decoration: underline;
}

@media (max-width: 640px) {
  .register-form-container {
    padding: 1rem;
  }
  
  .register-form-card {
    padding: 2rem 1.5rem;
  }
  
  .register-title {
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