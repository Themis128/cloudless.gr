<template>
  <v-container fluid fill-height class="auth-container d-flex justify-center align-center">
    <div class="auth-wrapper">
      <v-card
        class="glass-card pa-6 pa-sm-8"
        width="100%"
        max-width="520"
        elevation="10"
        data-cy="reset-password-form"
        data-testid="reset-password-form"
      >
        <v-card-title class="text-h5 text-white text-center mb-2">
          Reset Password
        </v-card-title>
        <v-card-subtitle class="text-center text-blue-200 mb-6">
          Enter your new password below
        </v-card-subtitle>

        <v-form ref="form" validate-on="submit lazy" @submit.prevent="handlePasswordReset">
          <!-- Error/Success Alerts -->
          <v-alert
            v-if="error"
            type="error"
            class="mb-4"
            border="start"
            prominent
            data-cy="error-alert"
          >
            {{ error }}
          </v-alert>
          
          <v-alert
            v-if="successMessage"
            type="success"
            class="mb-4"
            border="start"
            prominent
            data-cy="success-alert"
          >
            {{ successMessage }}
          </v-alert>

          <!-- New Password Field -->
          <v-text-field
            v-model="newPassword"
            label="New Password"
            placeholder="Enter your new password"
            prepend-icon="mdi-lock-outline"
            :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showPassword ? 'text' : 'password'"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-2"
            :rules="passwordRules"
            :disabled="loading"
            data-cy="new-password-input"
            data-testid="new-password-input"
            autocomplete="new-password"
            @click:append="showPassword = !showPassword"
          />

          <!-- Password Requirements -->
          <v-card
            v-if="newPassword"
            class="mb-4 pa-3"
            color="rgba(255, 255, 255, 0.08)"
            variant="outlined"
          >
            <v-card-subtitle class="text-white pa-0 mb-2">
              Password Requirements:
            </v-card-subtitle>
            <div class="requirements-grid">
              <v-chip
                v-for="(requirement, key) in passwordRequirements"
                :key="key"
                :color="passwordChecks[key] ? 'green' : 'orange'"
                :variant="passwordChecks[key] ? 'elevated' : 'outlined'"
                size="small"
                class="ma-1"
              >
                <v-icon start :icon="passwordChecks[key] ? 'mdi-check' : 'mdi-close'" />
                {{ requirement }}
              </v-chip>
            </div>
          </v-card>

          <!-- Confirm Password Field -->
          <v-text-field
            v-model="confirmPassword"
            label="Confirm New Password"
            placeholder="Confirm your new password"
            prepend-icon="mdi-lock-check-outline"
            :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showConfirmPassword ? 'text' : 'password'"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-6"
            :rules="confirmPasswordRules"
            :disabled="loading"
            data-cy="confirm-password-input"
            data-testid="confirm-password-input"
            autocomplete="new-password"
            @click:append="showConfirmPassword = !showConfirmPassword"
          />

          <!-- Submit Button -->
          <v-btn
            type="submit"
            size="large"
            color="primary"
            variant="elevated"
            block
            class="update-btn mt-4 mb-6"
            :loading="loading"
            :disabled="loading || !isFormValid"
            data-cy="update-password-button"
            data-testid="update-password-button"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ loading ? 'Updating Password...' : 'Update Password' }}
          </v-btn>

          <!-- Navigation Links -->
          <v-card-text class="text-center pa-0">
            <span class="text-white">
              <NuxtLink 
                to="/auth" 
                class="text-blue-300 text-decoration-none font-weight-medium"
              >
                Back to Sign In
              </NuxtLink>
            </span>
          </v-card-text>
        </v-form>
      </v-card>
    </div>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Page meta
definePageMeta({
  layout: 'auth'
})

// Composables
const { useCustomSupabaseClient } = await import('~/composables/useCustomSupabaseClient')
const supabase = useCustomSupabaseClient()
const route = useRoute()

// Form ref
const form = ref()

// Reactive state
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

// Password requirements for display
const passwordRequirements = {
  length: '8+ characters',
  uppercase: 'Uppercase letter',
  lowercase: 'Lowercase letter', 
  number: 'Number',
  special: 'Special character'
}

// Password validation
const passwordChecks = computed(() => ({
  length: newPassword.value.length >= 8,
  uppercase: /[A-Z]/.test(newPassword.value),
  lowercase: /[a-z]/.test(newPassword.value),
  number: /\d/.test(newPassword.value),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword.value)
}))

const isPasswordValid = computed(() => {
  return Object.values(passwordChecks.value).every(check => check)
})

const isFormValid = computed(() => {
  return newPassword.value &&
         confirmPassword.value &&
         isPasswordValid.value &&
         newPassword.value === confirmPassword.value
})

// Validation rules
const passwordRules = [
  v => !!v || 'Password is required',
  v => (v && v.length >= 8) || 'Password must be at least 8 characters',
  v => (v && /[A-Z]/.test(v)) || 'Password must contain an uppercase letter',
  v => (v && /[a-z]/.test(v)) || 'Password must contain a lowercase letter',
  v => (v && /\d/.test(v)) || 'Password must contain a number',
  v => (v && /[!@#$%^&*(),.?":{}|<>]/.test(v)) || 'Password must contain a special character'
]

const confirmPasswordRules = [
  v => !!v || 'Please confirm your password',
  v => v === newPassword.value || 'Passwords do not match'
]

// Check for reset tokens on mount
onMounted(async () => {
  const { access_token, refresh_token } = route.query
  
  if (!access_token || !refresh_token) {
    error.value = 'Invalid reset link. Please request a new password reset.'
    return
  }
  
  try {
    // Set the session with the tokens from the URL
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: String(access_token),
      refresh_token: String(refresh_token)
    })
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      error.value = 'Invalid or expired reset link. Please request a new password reset.'
    } else {
      console.log('Reset session established successfully')
    }
  } catch (err) {
    console.error('Error setting session:', err)
    error.value = 'An error occurred. Please try again.'
  }
})

// Password reset handler
const handlePasswordReset = async () => {
  // Validate form
  const { valid } = await form.value.validate()
  if (!valid) {
    return
  }

  loading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      error.value = updateError.message || 'Failed to update password. Please try again.'
      return
    }

    successMessage.value = 'Password updated successfully! Redirecting to sign in...'
    
    // Clear form
    newPassword.value = ''
    confirmPassword.value = ''
    
    // Sign out and redirect to login
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigateTo('/auth?message=password-reset-success')
    }, 2000)

  } catch (err) {
    console.error('Password reset error:', err)
    error.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

// SEO
useHead({
  title: 'Reset Password - Cloudless',
  meta: [
    { name: 'description', content: 'Reset your Cloudless account password' }
  ]
})
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  padding: 20px;
}

.auth-wrapper {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

/* Glass card styling */
.glass-card {
  background: rgba(255, 255, 255, 0.12) !important;
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.3);
}

/* Glass input styling */
.glass-input {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.glass-input :deep(.v-field) {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(2px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-input :deep(.v-field__input) {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
  letter-spacing: 0.02em;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}

.glass-input :deep(.v-field__overlay) {
  background: transparent !important;
}

.glass-input :deep(.v-label) {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
}

.glass-input :deep(.v-field__prepend-inner .v-icon),
.glass-input :deep(.v-field__append-inner .v-icon) {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Password requirements grid */
.requirements-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

/* Update button */
.update-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  backdrop-filter: blur(10px);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.update-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

/* Link styling */
.text-blue-300 {
  color: #93c5fd !important;
  transition: color 0.2s ease;
}

.text-blue-300:hover {
  color: #dbeafe !important;
}

/* Mobile responsiveness */
@media (max-width: 600px) {
  .auth-container {
    padding: 12px;
  }
  
  .glass-card {
    border-radius: 12px;
    max-width: 100%;
  }
  
  .glass-card :deep(.v-card-title) {
    font-size: 1.5rem !important;
  }
  
  .glass-card :deep(.v-card-subtitle) {
    font-size: 0.9rem !important;
  }
  
  .glass-input :deep(.v-field__input) {
    font-size: 1rem;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  
  .update-btn {
    font-size: 1rem;
    min-height: 48px;
  }

  .requirements-grid {
    gap: 4px;
  }
}

@media (max-width: 360px) {
  .glass-card {
    border-radius: 8px;
  }
  
  .requirements-grid {
    justify-content: center;
  }
}
</style>
