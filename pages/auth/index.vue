<template>
  <v-container fluid fill-height class="auth-container d-flex justify-center align-center">
    <div class="auth-wrapper">
      <v-card
        class="glass-card pa-6 pa-sm-8"
        width="100%"
        max-width="420"
        elevation="10"
        data-cy="signin-form"
        data-testid="signin-form"
      >
        <v-card-title class="text-h4 text-white text-center mb-2">
          Welcome to Cloudless.gr
        </v-card-title>
        <v-card-subtitle class="text-center text-blue-200 mb-6">
          Sign in to your account
        </v-card-subtitle>

        <v-form ref="form" validate-on="submit lazy" @submit.prevent="handleSubmit">
          <!-- Error/Success Alerts -->
          <v-alert
            v-if="authError"
            type="error"
            class="mb-4"
            border="start"
            prominent
            data-cy="error-alert"
          >
            {{ authError }}
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
            v-model="formData.email"
            label="Email Address"
            placeholder="Enter your email address"
            prepend-icon="mdi-email-outline"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-4"
            :rules="emailRules"
            :disabled="isLoading"
            data-cy="email-input"
            data-testid="email-input"
            type="email"
            autocomplete="email"
          />

          <!-- Password Field -->
          <v-text-field
            v-model="formData.password"
            label="Password"
            placeholder="Enter your password"
            prepend-icon="mdi-lock-outline"
            :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showPassword ? 'text' : 'password'"
            clearable
            variant="solo-inverted"
            color="blue"
            class="glass-input mb-6"
            :rules="passwordRules"
            :disabled="isLoading"
            data-cy="password-input"
            data-testid="password-input"
            autocomplete="current-password"
            @click:append="showPassword = !showPassword"
          />

          <!-- Submit Button -->
          <v-btn
            type="submit"
            size="large"
            color="primary"
            variant="elevated"
            block
            class="signin-btn mt-4 mb-6"
            :loading="isLoading"
            :disabled="isLoading || !isFormValid"
            data-cy="signin-button"
            data-testid="signin-button"
          >
            <v-icon start>mdi-login</v-icon>
            {{ isLoading ? 'Signing in...' : 'Sign In' }}
          </v-btn>

          <!-- Navigation Links -->
          <v-card-text class="text-center pa-0">
            <div class="mb-3">
              <span class="text-white">
                Don't have an account? 
                <NuxtLink 
                  to="/auth/register" 
                  class="text-blue-300 text-decoration-none font-weight-medium"
                >
                  Sign up here
                </NuxtLink>
              </span>
            </div>
            <div>
              <span class="text-white">
                <NuxtLink 
                  to="/auth/forgot-password" 
                  class="text-blue-300 text-decoration-none font-weight-medium"
                >
                  Forgot your password?
                </NuxtLink>
              </span>
            </div>
          </v-card-text>
        </v-form>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// Initialize Supabase client manually
const supabaseUrl = 'http://192.168.0.23:54321'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const client = createClient(supabaseUrl, supabaseKey)

// Local state
const authError = ref('')
const isLoading = ref(false)
const user = ref<User | null>(null)

// Sign in function
const signIn = async (email: string, password: string) => {
  try {
    authError.value = ''
    isLoading.value = true
    
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      authError.value = error.message
      return { success: false, error: error.message }
    }
    
    user.value = data.user
    return { success: true, user: data.user }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign in failed'
    authError.value = message
    return { success: false, error: message }
  } finally {
    isLoading.value = false
  }
}

interface AuthForm {
  email: string
  password: string
}

// Form ref
const form = ref()

// Reactive state
const formData = ref<AuthForm>({
  email: '',
  password: ''
})

const showPassword = ref(false)
const successMessage = ref('')

// Computed
const isFormValid = computed(() => {
  return formData.value.email.length > 0 && 
         formData.value.password.length > 0
})

// Validation rules
const emailRules = [
  (v: string) => !!v || 'Email is required',
  (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid'
]

const passwordRules = [
  (v: string) => !!v || 'Password is required',
  (v: string) => (v && v.length >= 6) || 'Password must be at least 6 characters'
]

// Methods
const handleSubmit = async () => {
  try {
    // Validate form
    const { valid } = await form.value.validate()
    if (!valid) {
      return
    }

    // Clear previous messages
    successMessage.value = ''
    
    isLoading.value = true
    
    // Attempt sign in using built-in auth
    const result = await signIn(formData.value.email, formData.value.password)
    
    if (result.success && result.user) {
      successMessage.value = 'Sign in successful! Redirecting...'
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Redirect to users index page
      window.location.href = '/users/index'
    } else {
      // Handle errors
      authError.value = result.error || 'Sign in failed'
    }
  } catch (error) {
    console.error('Sign in error:', error)
    authError.value = 'An unexpected error occurred'
  } finally {
    isLoading.value = false
  }
}

// Check if user is already authenticated
onMounted(async () => {
  if (user.value) {
    window.location.href = '/users/index'
  }
})
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
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

/* Sign in button */
.signin-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  backdrop-filter: blur(10px);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.signin-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.signin-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
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
  
  .signin-btn {
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
