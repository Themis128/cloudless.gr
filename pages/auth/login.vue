<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card>
          <v-card-title class="text-h4 text-center pa-6"> Login </v-card-title>

          <v-card-text>
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                required
                prepend-icon="mdi-email"
                class="mb-4"
              />

              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                required
                prepend-icon="mdi-lock"
                :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append="showPassword = !showPassword"
                class="mb-4"
                :style="{
                  '-webkit-text-security': showPassword ? 'none' : 'disc',
                }"
                autocomplete="current-password"
              />

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :loading="loading"
              >
                Login
              </v-btn>

              <!-- Debug button to test form data -->
              <v-btn
                type="button"
                color="secondary"
                block
                size="large"
                class="mt-2"
                @click="testFormData"
              >
                Test Form Data
              </v-btn>
            </v-form>

            <v-alert
              v-if="error"
              type="error"
              class="mt-4"
              dismissible
              @click:close="error = null"
            >
              {{ error }}
            </v-alert>
          </v-card-text>

          <v-card-actions class="justify-center pb-4">
            <span>Don't have an account?</span>
            <v-btn text color="primary" to="/auth/register" class="ml-2">
              Register
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/authStore'

const authStore = useAuthStore()
const router = useRouter()

const form = ref({
  email: '',
  password: '',
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const handleLogin = async () => {
  console.log('handleLogin called with form data:', form.value)

  // Prevent double submission
  if (loading.value) {
    console.log('Login already in progress, ignoring submission')
    return
  }

  // Basic validation
  if (!form.value.email || !form.value.password) {
    error.value = 'Email and password are required'
    console.log('Validation failed: missing email or password')
    return
  }

  // Email format validation
  if (!/.+@.+\..+/.test(form.value.email)) {
    error.value = 'Please enter a valid email address'
    console.log('Validation failed: invalid email format')
    return
  }

  loading.value = true
  error.value = null

  try {
    console.log('Sending login request with:', {
      email: form.value.email,
      password: form.value.password ? '[REDACTED]' : 'undefined',
    })

    const result = await authStore.login({
      email: form.value.email,
      password: form.value.password,
    })

    console.log('Login result:', result)

    if (result.success) {
      // Get redirect path based on user role
      const redirectTo = authStore.user
        ? authStore.getRedirectPath(authStore.user)
        : '/dashboard'
      console.log('Redirecting to:', redirectTo)
      await router.push(redirectTo)
    } else {
      error.value = result.error || 'Login failed'
      console.log('Login failed:', result.error)
    }
  } catch (err: any) {
    console.error('Login error:', err)
    error.value = err.message || 'An error occurred during login'
  } finally {
    loading.value = false
  }
}

const testFormData = () => {
  console.log('Current form data:', form.value)
  console.log('Email length:', form.value.email?.length)
  console.log('Password length:', form.value.password?.length)
  console.log('Email value:', form.value.email)
  console.log('Password value:', form.value.password ? '[REDACTED]' : 'undefined')
}
</script>

<style scoped>
.v-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-card {
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

/* Override global styles for login page */
.v-text-field .v-field__input {
  color: #000000 !important;
}

.v-text-field .v-field__label {
  color: #666666 !important;
}

/* Ensure password field is always visible */
.v-text-field input[type='password'] {
  -webkit-text-security: disc;
  text-security: disc;
  color: #000000 !important;
}

.v-text-field input[type='text'] {
  -webkit-text-security: none;
  text-security: none;
  color: #000000 !important;
}

/* Ensure input text is visible */
.v-text-field input {
  color: #000000 !important;
  background: transparent !important;
}

/* Fix for password field visibility */
.v-text-field__input {
  color: #000000 !important;
}

/* Override any global white text styles */
.v-card .v-text-field .v-field__input {
  color: #000000 !important;
}

.v-card .v-text-field .v-field__label {
  color: #666666 !important;
}
</style>
