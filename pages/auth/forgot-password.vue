<template>
  <v-container fluid fill-height class="auth-container d-flex justify-center align-center">
    <div class="auth-wrapper">
      <v-card
        class="glass-card pa-6 pa-sm-8"
        width="100%"
        max-width="420"
        elevation="10"
        data-cy="forgot-password-form"
        data-testid="forgot-password-form"
      >
        <v-card-title class="text-h5 text-white text-center mb-2">
          Reset Password
        </v-card-title>
        <v-card-subtitle class="text-center text-blue-200 mb-6">
          Enter your email address and we'll send you a link to reset your password
        </v-card-subtitle>

        <v-form ref="form" validate-on="submit lazy" @submit.prevent="handleResetPassword">
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

          <!-- Email Field -->
          <v-text-field
            v-model="email"
            label="Email Address"
            placeholder="Enter your email address"
            prepend-icon="mdi-email-outline"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-6"
            :rules="emailRules"
            :disabled="loading"
            data-cy="email-input"
            data-testid="email-input"
            type="email"
            autocomplete="email"
          />

          <!-- Submit Button -->
          <v-btn
            type="submit"
            size="large"
            color="primary"
            variant="elevated"
            block
            class="reset-btn mt-4 mb-6"
            :loading="loading"
            :disabled="loading || !isFormValid"
            data-cy="reset-button"
            data-testid="reset-button"
          >
            <v-icon start>mdi-email-send</v-icon>
            {{ loading ? 'Sending Reset Link...' : 'Send Reset Link' }}
          </v-btn>

          <!-- Navigation Links -->
          <v-card-text class="text-center pa-0">
            <div class="mb-3">
              <span class="text-white">
                Remember your password? 
                <NuxtLink 
                  to="/auth" 
                  class="text-blue-300 text-decoration-none font-weight-medium"
                >
                  Sign in here
                </NuxtLink>
              </span>
            </div>
            <div>
              <span class="text-white">
                Don't have an account? 
                <NuxtLink 
                  to="/auth/register" 
                  class="text-blue-300 text-decoration-none font-weight-medium"
                >
                  Create one
                </NuxtLink>
              </span>
            </div>
          </v-card-text>
        </v-form>
      </v-card>
    </div>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'

// Page meta
definePageMeta({
  layout: 'auth'
})

// Composables
const { resetPassword } = useAuth()

// Form ref
const form = ref()

// Reactive state
const email = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

// Computed properties
const isFormValid = computed(() => {
  return email.value && /.+@.+\..+/.test(email.value)
})

// Validation rules
const emailRules = [
  v => !!v || 'Email is required',
  v => /.+@.+\..+/.test(v) || 'Email must be valid'
]

// Reset password handler
const handleResetPassword = async () => {
  // Validate form
  const { valid } = await form.value.validate()
  if (!valid) {
    return
  }

  loading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const result = await resetPassword(email.value)

    if (result.success) {
      successMessage.value = 'Password reset link sent! Please check your email and follow the instructions to reset your password.'
      
      // Clear form after successful submission
      email.value = ''
      
      // Redirect after showing success message
      setTimeout(() => {
        navigateTo('/auth?message=reset-sent')
      }, 5000)
    } else {
      error.value = result.error || 'Failed to send reset link. Please try again.'
    }
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
  max-width: 420px;
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

/* Reset button */
.reset-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  backdrop-filter: blur(10px);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.reset-btn:hover {
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
@media (max-width: 480px) {
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
  
  .reset-btn {
    font-size: 1rem;
    min-height: 48px;
  }
}

@media (max-width: 360px) {
  .glass-card {
    border-radius: 8px;
  }
}
</style>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
}

.auth-header {
  text-align: center;
  margin-bottom: 30px;
}

.auth-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 8px 0;
}

.auth-header p {
  color: #718096;
  font-size: 16px;
  margin: 0;
  line-height: 1.5;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-weight: 600;
  color: #2d3748;
  font-size: 14px;
}

.form-input {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s ease;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input.error {
  border-color: #e53e3e;
  box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
}

.form-input:disabled {
  background-color: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  font-size: 14px;
  color: #e53e3e;
  font-weight: 500;
}

.error-alert, .success-alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.error-alert {
  background-color: #fed7d7;
  color: #c53030;
  border: 1px solid #feb2b2;
}

.success-alert {
  background-color: #c6f6d5;
  color: #2f855a;
  border: 1px solid #9ae6b4;
}

.error-content, .success-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 52px;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.auth-footer p {
  color: #718096;
  font-size: 14px;
  margin: 0 0 8px 0;
}

.auth-footer p:last-child {
  margin-bottom: 0;
}

.link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s ease;
}

.link:hover {
  color: #5a67d8;
  text-decoration: underline;
}

/* Responsive Design */
@media (max-width: 640px) {
  .auth-container {
    padding: 10px;
  }
  
  .auth-card {
    padding: 30px 20px;
  }
  
  .auth-header h1 {
    font-size: 24px;
  }
  
  .auth-header p {
    font-size: 14px;
  }
}
</style>
