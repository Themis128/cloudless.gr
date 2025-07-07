<template>
  <v-container fluid fill-height class="auth-container d-flex justify-center align-center">
    <div class="auth-wrapper">
      <v-card
        class="glass-card pa-6 pa-sm-8"
        width="100%"
        max-width="480"
        elevation="10"
        data-cy="register-form"
        data-testid="register-form"
      >
        <v-card-title class="text-h5 text-white text-center mb-2">
          Create Account
        </v-card-title>
        <v-card-subtitle class="text-center text-blue-200 mb-6">
          Sign up to get started with Cloudless
        </v-card-subtitle>

        <v-form ref="form" validate-on="submit lazy" @submit.prevent="handleRegister">
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

          <!-- Full Name Field -->
          <v-text-field
            v-model="fullName"
            label="Full Name"
            prepend-icon="mdi-account"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-4"
            :rules="fullNameRules"
            :disabled="loading"
            data-cy="fullname-input"
            data-testid="fullname-input"
            type="text"
            autocomplete="name"
          />

          <!-- Email Field -->
          <v-text-field
            v-model="email"
            label="Email Address"
            placeholder="you@example.com"
            prepend-icon="mdi-email-outline"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-4"
            :rules="emailRules"
            :disabled="loading"
            data-cy="email-input"
            data-testid="email-input"
            type="email"
            autocomplete="email"
          />

          <!-- Password Field -->
          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            prepend-icon="mdi-lock-outline"
            :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-2"
            :rules="passwordRules"
            :disabled="loading"
            data-cy="password-input"
            data-testid="password-input"
            autocomplete="new-password"
            @click:append="showPassword = !showPassword"
          />

          <!-- Password Requirements -->
          <v-card 
            v-if="password"
            class="password-requirements mb-4"
            variant="outlined"
            color="blue-grey-lighten-3"
          >
            <v-card-text class="py-3">
              <div class="text-caption text-blue-200 mb-2 font-weight-medium">
                Password Requirements:
              </div>
              <v-row dense>
                <v-col cols="6">
                  <div class="d-flex align-center">
                    <v-icon 
                      :color="passwordChecks.length ? 'success' : 'grey'" 
                      size="16" 
                      class="mr-2"
                    >
                      {{ passwordChecks.length ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                    </v-icon>
                    <span 
                      class="text-caption"
                      :class="passwordChecks.length ? 'text-green-300' : 'text-grey-400'"
                    >
                      8+ characters
                    </span>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="d-flex align-center">
                    <v-icon 
                      :color="passwordChecks.uppercase ? 'success' : 'grey'" 
                      size="16" 
                      class="mr-2"
                    >
                      {{ passwordChecks.uppercase ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                    </v-icon>
                    <span 
                      class="text-caption"
                      :class="passwordChecks.uppercase ? 'text-green-300' : 'text-grey-400'"
                    >
                      Uppercase
                    </span>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="d-flex align-center">
                    <v-icon 
                      :color="passwordChecks.lowercase ? 'success' : 'grey'" 
                      size="16" 
                      class="mr-2"
                    >
                      {{ passwordChecks.lowercase ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                    </v-icon>
                    <span 
                      class="text-caption"
                      :class="passwordChecks.lowercase ? 'text-green-300' : 'text-grey-400'"
                    >
                      Lowercase
                    </span>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="d-flex align-center">
                    <v-icon 
                      :color="passwordChecks.number ? 'success' : 'grey'" 
                      size="16" 
                      class="mr-2"
                    >
                      {{ passwordChecks.number ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                    </v-icon>
                    <span 
                      class="text-caption"
                      :class="passwordChecks.number ? 'text-green-300' : 'text-grey-400'"
                    >
                      Number
                    </span>
                  </div>
                </v-col>
                <v-col cols="12">
                  <div class="d-flex align-center">
                    <v-icon 
                      :color="passwordChecks.special ? 'success' : 'grey'" 
                      size="16" 
                      class="mr-2"
                    >
                      {{ passwordChecks.special ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                    </v-icon>
                    <span 
                      class="text-caption"
                      :class="passwordChecks.special ? 'text-green-300' : 'text-grey-400'"
                    >
                      Special character
                    </span>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Confirm Password Field -->
          <v-text-field
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            label="Confirm Password"
            prepend-icon="mdi-lock-check"
            :append-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-4"
            :rules="confirmPasswordRules"
            :disabled="loading"
            data-cy="confirm-password-input"
            data-testid="confirm-password-input"
            autocomplete="new-password"
            @click:append="showConfirmPassword = !showConfirmPassword"
          />

          <!-- Terms and Privacy Checkbox -->
          <v-checkbox
            v-model="acceptTerms"
            color="blue"
            class="text-white mb-4"
            :rules="termsRules"
            :disabled="loading"
            data-cy="terms-checkbox"
            data-testid="terms-checkbox"
          >
            <template #label>
              <span class="text-white">
                I agree to the 
                <a 
                  href="/terms" 
                  target="_blank" 
                  class="text-blue-300 text-decoration-none"
                  @click.stop
                >
                  Terms of Service
                </a> 
                and 
                <a 
                  href="/privacy" 
                  target="_blank" 
                  class="text-blue-300 text-decoration-none"
                  @click.stop
                >
                  Privacy Policy
                </a>
              </span>
            </template>
          </v-checkbox>

          <!-- Submit Button -->
          <v-btn
            type="submit"
            size="large"
            color="primary"
            variant="elevated"
            block
            class="create-account-btn mt-4 mb-6"
            :loading="loading"
            :disabled="loading || !isFormValid"
            data-cy="register-button"
            data-testid="register-button"
          >
            <v-icon start>mdi-account-plus</v-icon>
            {{ loading ? 'Creating Account...' : 'Create Account' }}
          </v-btn>

          <!-- Sign In Link -->
          <v-card-text class="text-center pa-0">
            <span class="text-white">
              Already have an account? 
              <NuxtLink 
                to="/auth" 
                class="text-blue-300 text-decoration-none font-weight-medium"
              >
                Sign in here
              </NuxtLink>
            </span>
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
const { signUp } = useAuth()

// Form ref
const form = ref()

// Reactive state
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const fullName = ref('')
const acceptTerms = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

// Password validation
const passwordChecks = computed(() => ({
  length: password.value.length >= 8,
  uppercase: /[A-Z]/.test(password.value),
  lowercase: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(password.value)
}))

const isPasswordValid = computed(() => {
  return Object.values(passwordChecks.value).every(check => check)
})

const isFormValid = computed(() => {
  return email.value &&
         password.value &&
         confirmPassword.value &&
         fullName.value &&
         acceptTerms.value &&
         isPasswordValid.value &&
         password.value === confirmPassword.value
})

// Validation rules
const emailRules = [
  v => !!v || 'Email is required',
  v => /.+@.+\..+/.test(v) || 'Email must be valid'
]

const fullNameRules = [
  v => !!v || 'Full name is required',
  v => (v && v.length >= 2) || 'Name must be at least 2 characters',
  v => (v && /^[a-zA-Z\s]+$/.test(v)) || 'Name can only contain letters and spaces'
]

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
  v => (v === password.value) || 'Passwords do not match'
]

const termsRules = [
  v => !!v || 'You must accept the terms and conditions'
]

// Registration handler
const handleRegister = async () => {
  // Validate form
  const { valid } = await form.value.validate()
  if (!valid) {
    return
  }

  loading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const result = await signUp(email.value, password.value, {
      full_name: fullName.value.trim()
    })

    if (result.success) {
      successMessage.value = 'Registration successful! Please check your email to verify your account.'
      
      // Clear form
      email.value = ''
      password.value = ''
      confirmPassword.value = ''
      fullName.value = ''
      acceptTerms.value = false
      
      // Redirect after a delay to show success message
      setTimeout(() => {
        navigateTo('/auth?message=registration-success')
      }, 3000)
    } else {
      error.value = result.error || 'Registration failed. Please try again.'
    }
  } catch (err) {
    console.error('Registration error:', err)
    error.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

// SEO
useHead({
  title: 'Create Account - Cloudless',
  meta: [
    { name: 'description', content: 'Create your Cloudless account to get started' }
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
  max-width: 480px;
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

/* Password requirements card */
.password-requirements {
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}

/* Create account button */
.create-account-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  backdrop-filter: blur(10px);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.create-account-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

/* Checkbox styling */
:deep(.v-checkbox .v-label) {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
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
  
  .glass-input :deep(.v-field__input) {
    font-size: 1rem;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  
  .create-account-btn {
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
