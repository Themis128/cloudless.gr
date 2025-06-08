<template>
  <v-container fluid class="d-flex flex-column justify-center align-center min-height-screen pa-4">
    <div class="w-100" style="max-width: 400px;">
      <!-- Logo/Brand Section -->
      <div class="text-center mb-8">
        <h1 class="text-h3 font-weight-bold text-white mb-2">Cloudless</h1>
        <p class="text-body-1 text-white">Create your account to get started.</p>
      </div>

      <v-card class="register-card" elevation="24">
        <v-card-title class="text-center pb-2">
          <h2 class="text-h5 font-weight-medium">Create Account</h2>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="handleRegister">
            <v-text-field
              v-model="firstName"
              label="First Name"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              class="mb-4"
              required
            />
            <v-text-field
              v-model="lastName"
              label="Last Name"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              class="mb-4"
              required
            />
            <v-text-field
              v-model="email"
              label="Email Address"
              type="email"
              prepend-inner-icon="mdi-email"
              variant="outlined"
              class="mb-4"
              required
              :error-messages="emailErrors"
              @blur="validateEmail"
            />
            <v-text-field
              v-model="password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock"
              :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="showPassword = !showPassword"
              variant="outlined"
              class="mb-4"
              required
              :error-messages="passwordErrors"
              @blur="validatePassword"
            />
            <v-text-field
              v-model="confirmPassword"
              label="Confirm Password"
              :type="showConfirmPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-check"
              :append-inner-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="showConfirmPassword = !showConfirmPassword"
              variant="outlined"
              class="mb-6"
              required
              :error-messages="confirmPasswordErrors"
              @blur="validateConfirmPassword"
            />

            <v-btn 
              type="submit" 
              block 
              color="primary" 
              size="large"
              :loading="loading" 
              class="mb-4 register-btn"
              :disabled="!isFormValid"
            >
              <v-icon left>mdi-account-plus</v-icon>
              Create Account
            </v-btn>
          </v-form>          <v-divider class="my-6">
            <span class="text-body-2 text-medium-emphasis pa-4">or sign up with</span>
          </v-divider>

          <!-- Social Registration Buttons -->
          <div class="d-flex flex-column ga-3">
            <v-btn 
              block 
              variant="outlined" 
              size="large"
              @click="signUpWith('google')" 
              :loading="loading"
              class="social-btn"
            >
              <v-icon left color="#4285F4">mdi-google</v-icon>
              Sign up with Google
            </v-btn>
            <v-btn 
              block 
              variant="outlined" 
              size="large"
              @click="signUpWith('github')" 
              :loading="loading"
              class="social-btn"
            >
              <v-icon left>mdi-github</v-icon>
              Sign up with GitHub
            </v-btn>
          </div>

          <!-- Error Alert -->
          <v-alert 
            v-if="error" 
            :type="error.startsWith('✅') ? 'success' : 'error'" 
            class="mt-4" 
            closable 
            @click:close="error = ''"
            variant="tonal"
          >
            {{ error }}
          </v-alert>
        </v-card-text>        <v-card-actions class="pa-6 pt-0">
          <div class="w-100 text-center">
            <p class="text-body-2 text-medium-emphasis">
              Already have an account? 
              <NuxtLink to="/auth/login" class="text-primary text-decoration-none font-weight-medium">
                Sign in here
              </NuxtLink>
            </p>
          </div>
        </v-card-actions>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  public: true,
})

const router = useRouter()
const supabase = useSupabaseClient()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const emailErrors = ref<string[]>([])
const passwordErrors = ref<string[]>([])
const confirmPasswordErrors = ref<string[]>([])

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isFormValid = computed(() => {
  return firstName.value && 
         lastName.value && 
         email.value && 
         password.value && 
         confirmPassword.value &&
         isValidEmail(email.value) && 
         password.value.length >= 8 &&
         password.value === confirmPassword.value
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
  } else if (password.value.length < 8) {
    passwordErrors.value.push('Password must be at least 8 characters')
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password.value)) {
    passwordErrors.value.push('Password must contain uppercase, lowercase, and number')
  }
}

const validateConfirmPassword = () => {
  confirmPasswordErrors.value = []
  if (!confirmPassword.value) {
    confirmPasswordErrors.value.push('Please confirm your password')
  } else if (password.value !== confirmPassword.value) {
    confirmPasswordErrors.value.push('Passwords do not match')
  }
}

const handleRegister = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          first_name: firstName.value,
          last_name: lastName.value,
          full_name: `${firstName.value} ${lastName.value}`
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (signUpError) throw signUpError

    if (data?.user && !data?.user?.email_confirmed_at) {
      error.value = '✅ Registration successful! Please check your email to verify your account.'
    } else if (data?.user) {
      router.push('/dashboard')
    }
  } catch (err: any) {
    error.value = err.message || 'Registration failed'
  } finally {
    loading.value = false
  }
}

const signUpWith = async (provider: 'google' | 'github') => {
  loading.value = true
  error.value = ''
  
  try {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) throw oauthError
  } catch (err: any) {
    error.value = err.message || `Registration with ${provider} failed`
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px !important;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 
              0 15px 30px rgba(0, 0, 0, 0.1),
              0 10px 15px rgba(0, 0, 0, 0.1) !important;
}

.dark .register-card {
  background: rgba(30, 30, 30, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.register-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  transition: all 0.3s ease !important;
}

.register-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2) !important;
}

.social-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  transition: all 0.3s ease !important;
  border: 2px solid rgba(0, 0, 0, 0.12) !important;
}

.social-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  border-color: var(--v-theme-primary) !important;
}

.dark .social-btn {
  border: 2px solid rgba(255, 255, 255, 0.12) !important;
}

.dark .social-btn:hover {
  border-color: var(--v-theme-primary) !important;
}

:deep(.v-field--variant-outlined .v-field__outline) {
  border-radius: 12px !important;
}

:deep(.v-field--variant-outlined.v-field--focused .v-field__outline) {
  border-width: 2px !important;
}

:deep(.v-btn--variant-text) {
  text-transform: none !important;
  font-weight: 500 !important;
}

:deep(.v-field) {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:deep(.v-field--focused) {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.2) !important;
}

:deep(.v-field),
:deep(.v-btn),
:deep(.v-alert) {
  transition: all 0.3s ease !important;
}

.space-y-3 > * + * {
  margin-top: 12px;
}

:deep(.text-primary) {
  transition: all 0.2s ease !important;
}

:deep(.text-primary:hover) {
  text-decoration: underline !important;
  transform: translateY(-1px);
}

:deep(.v-alert) {
  border-radius: 12px !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
</style>
