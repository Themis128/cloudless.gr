<template>
  <VCard class="glass-card pa-8 ma-4">
    <VCardTitle class="text-center text-h5 font-weight-bold mb-4">
      <VIcon class="mr-2">mdi-account-circle</VIcon>
      Welcome Back
    </VCardTitle>
    
    <VCardSubtitle class="text-center mb-4">
      Sign in to your Cloudless.gr account
    </VCardSubtitle>

    <VForm
      ref="formRef"
      v-model="formState.isValid"
      fast-fail
      @submit.prevent="handleLogin"
    >
      <VTextField
        v-model="formData.email"
        :rules="validationRules.email"
        label="Email"
        type="email"
        prepend-inner-icon="mdi-email"
        variant="outlined"
        :disabled="formState.loading"
        :error-messages="formErrors.email"
        class="mb-2"
        autocomplete="email"
        density="comfortable"
        validate-on="input lazy"
        required
        @blur="validateField('email')"
      />

      <VTextField
        v-model="formData.password"
        :rules="validationRules.password"
        label="Password"
        :type="showPassword ? 'text' : 'password'"
        prepend-inner-icon="mdi-lock"
        :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
        variant="outlined"
        :disabled="formState.loading"
        :error-messages="formErrors.password"
        class="mb-4"
        autocomplete="current-password"
        density="comfortable"
        validate-on="input lazy"
        required
        @click:append-inner="togglePasswordVisibility"
        @blur="validateField('password')"
      />

      <!-- Enhanced alert system -->
      <VAlert
        v-if="alerts.error"
        type="error"
        variant="outlined"
        class="mb-4"
        closable
        @click:close="clearError"
      >
        <template #prepend>
          <VIcon>mdi-alert-circle</VIcon>
        </template>
        {{ alerts.error }}
      </VAlert>

      <VAlert
        v-if="alerts.info"
        type="info"
        variant="outlined"
        class="mb-4"
        density="compact"
        closable
        @click:close="clearInfo"
      >
        <template #prepend>
          <VIcon>mdi-information</VIcon>
        </template>
        {{ alerts.info }}
      </VAlert>

      <VBtn
        type="submit"
        color="primary"
        size="large"
        block
        :loading="formState.loading"
        :disabled="!isSubmitEnabled"
        class="mb-4"
        elevation="2"
      >
        <template #prepend>
          <VIcon>mdi-login</VIcon>
        </template>
        Sign In
      </VBtn>
    </VForm>

    <!-- Enhanced footer with accessibility -->
    <div class="text-center">
      <p class="text-body-2 text-medium-emphasis mb-2">
        Don't have an account?
        <NuxtLink
          to="/auth/register"
          class="text-primary text-decoration-none font-weight-medium"
          :class="{ 'text-disabled': formState.loading }"
        >
          Sign up here
        </NuxtLink>
      </p>
      
      <p class="text-body-2 text-medium-emphasis">
        <NuxtLink
          to="/auth/reset"
          class="text-primary text-decoration-none"
          :class="{ 'text-disabled': formState.loading }"
        >
          Forgot your password?
        </NuxtLink>
      </p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import type { VForm } from 'vuetify/components'

// Types
interface FormData {
  email: string
  password: string
}

interface FormState {
  isValid: boolean
  loading: boolean
}

interface ValidationErrors {
  email: string[]
  password: string[]
}

interface Alerts {
  error: string
  info: string
}

// Emits
const emit = defineEmits<{
  success: []
}>()

// Stores
const authStore = useAuthStore()

// Reactive state
const formData = reactive<FormData>({
  email: '',
  password: ''
})

const formState = reactive<FormState>({
  isValid: false,
  loading: false
})

const formErrors = reactive<ValidationErrors>({
  email: [],
  password: []
})

const alerts = reactive<Alerts>({
  error: '',
  info: ''
})

// UI state
const showPassword = ref(false)
const formRef = ref<VForm>()

// Validation rules with better UX
const validationRules = computed(() => ({
  email: [
    (v: string) => !!v?.trim() || 'Email is required',
    (v: string) => {
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return pattern.test(v?.trim()) || 'Please enter a valid email address'
    },
    (v: string) => v?.trim().length <= 255 || 'Email must be less than 255 characters'
  ],
  password: [
    (v: string) => !!v || 'Password is required',
    (v: string) => v?.length >= 6 || 'Password must be at least 6 characters',
    (v: string) => v?.length <= 128 || 'Password must be less than 128 characters'
  ]
}))

// Computed properties
const isSubmitEnabled = computed(() => {
  return formState.isValid && 
         formData.email.trim() && 
         formData.password &&
         !formState.loading
})

// Methods
const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const clearError = () => {
  alerts.error = ''
}

const clearInfo = () => {
  alerts.info = ''
}

const validateField = async (field: keyof FormData) => {
  if (!formRef.value) return
  
  try {
    const rules = validationRules.value[field]
    const value = formData[field]
    formErrors[field] = []
    
    for (const rule of rules) {
      const result = rule(value)
      if (typeof result === 'string') {
        formErrors[field].push(result)
        break
      }
    }
  } catch (error) {
    console.warn('Field validation error:', error)
  }
}

const setRecentLogin = () => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('recent-login', Date.now().toString())
  }
}

// Enhanced login handler with better error handling and UX
const handleLogin = async () => {
  try {
    // Clear previous states
    clearError()
    clearInfo()
    formState.loading = true
    alerts.info = 'Validating credentials...'

    // Validate form
    if (!formRef.value) {
      throw new Error('Form validation failed')
    }

    const { valid } = await formRef.value.validate()
    if (!valid) {
      alerts.error = 'Please fix the errors above and try again'
      alerts.info = ''
      return
    }

    // Prepare credentials
    const credentials = {
      email: formData.email.trim().toLowerCase(),
      password: formData.password
    }

    console.log('[LOGIN] Attempting authentication for:', credentials.email)
    alerts.info = 'Authenticating...'

    // Attempt authentication
    const result = await authStore.signIn(credentials.email, credentials.password)
    
    if (!result.success) {
      throw new Error(result.error || 'Authentication failed')
    }

    console.log('[LOGIN] Authentication successful:', result.user?.email)
    alerts.info = 'Login successful!'
    
    // Set recent login flag for middleware
    setRecentLogin()
    
    // Clear sensitive data
    formData.password = ''
    
    // Brief success message before navigation
    setTimeout(() => {
      alerts.info = 'Redirecting...'
      emit('success')
      
      // Fallback navigation
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const targetPath = '/users/index'
          if (window.location.pathname !== targetPath) {
            window.location.href = targetPath
          }
        }
      }, 1000)
    }, 500)

  } catch (error) {
    console.error('[LOGIN] Authentication error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Login failed'
    alerts.error = getUserFriendlyError(errorMessage)
    alerts.info = ''
    
    // Clear password on error
    formData.password = ''
    
    // Focus email field for retry
    await nextTick()
    const emailField = document.querySelector('input[type="email"]') as HTMLInputElement
    if (emailField) {
      emailField.focus()
    }
    
  } finally {
    formState.loading = false
  }
}

// User-friendly error messages
const getUserFriendlyError = (error: string): string => {
  const errorLower = error.toLowerCase()
  
  if (errorLower.includes('invalid login credentials') || 
      errorLower.includes('invalid email or password')) {
    return 'Invalid email or password. Please check your credentials and try again.'
  }
  
  if (errorLower.includes('email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.'
  }
  
  if (errorLower.includes('too many requests')) {
    return 'Too many login attempts. Please wait a moment before trying again.'
  }
  
  if (errorLower.includes('network') || errorLower.includes('fetch')) {
    return 'Connection error. Please check your internet connection and try again.'
  }
  
  if (errorLower.includes('locked')) {
    return 'Account is temporarily locked due to multiple failed attempts.'
  }
  
  return error || 'An unexpected error occurred. Please try again.'
}

// Lifecycle - auto-focus email field
onMounted(() => {
  nextTick(() => {
    const emailField = document.querySelector('input[type="email"]') as HTMLInputElement
    if (emailField) {
      emailField.focus()
    }
  })
})
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.3);
  width: 100%;
  max-width: 400px;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .glass-card {
    margin: 0;
    border-radius: 12px;
    max-width: 100%;
  }
  
  .glass-card .v-card-title {
    font-size: 1.5rem !important;
  }
}

/* Field enhancements for glass card */
.glass-card :deep(.v-field) {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.glass-card :deep(.v-field--focused) {
  background: rgba(255, 255, 255, 0.15);
}

.glass-card :deep(.v-btn--variant-elevated) {
  backdrop-filter: blur(8px);
  background: rgba(var(--v-theme-primary), 0.9);
}

.glass-card :deep(.v-btn--variant-elevated:hover) {
  background: rgba(var(--v-theme-primary), 1);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(var(--v-theme-primary), 0.3);
}
</style>
