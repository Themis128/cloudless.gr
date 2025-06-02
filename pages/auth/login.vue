<template>
  <v-container fluid class="fill-height login-container">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="login-card">
          <div class="text-center mb-8">
            <h1 class="text-h4 font-weight-bold text-white">Welcome to Cloudless</h1>
          </div>

          <v-form @submit.prevent="handleEmailLogin">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              required
              :error-messages="emailError"
              @input="emailError = ''"
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
              class="login-field"
            />

            <v-text-field
              v-model="password"
              label="Password"
              type="password"
              required
              :error-messages="passwordError"
              @input="passwordError = ''"
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
              class="login-field"
            />

            <v-checkbox
              v-model="rememberMe"
              label="Remember me"
              color="primary"
              class="mb-4"
            />

            <v-alert
              v-if="error"
              type="error"
              class="mb-4"
              variant="tonal"
            >
              {{ error }}
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              block
              class="mb-4"
              :loading="isLoading"
            >
              Sign In
            </v-btn>

            <v-divider class="mb-4" />

            <div class="text-center">
              <p class="text-caption text-white">
                Demo credentials: user@cloudless.gr / demo123
              </p>
              <p class="text-caption text-white mb-4">
                Or: demo@cloudless.gr / password123
              </p>

              <p class="text-white">
                Don't have an account?
                <nuxt-link to="/auth/signup" class="text-primary">Sign up</nuxt-link>
              </p>
            </div>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from '#imports'
import { navigateTo } from 'nuxt/app'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'login',
  auth: false
})

const { login, isLoading, error } = useAuth()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const emailError = ref('')
const passwordError = ref('')

async function handleEmailLogin() {
  // Clear previous errors
  emailError.value = ''
  passwordError.value = ''

  // Validate fields
  if (!email.value) {
    emailError.value = 'Email is required'
    return
  }

  if (!password.value) {
    passwordError.value = 'Password is required'
    return
  }
  try {
    const success = await login(email.value, password.value, rememberMe.value)

    if (success) {
      await navigateTo('/dashboard')
    }  } catch (err: any) {
    console.error('Login failed:', err)
  }
}
</script>

<style scoped>
.login-container {
  position: relative;
  z-index: 1;
}

.login-card {
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2rem;
}

:deep(.login-field) {
  .v-field__overlay {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .v-field__field {
    color: white !important;
  }

  .v-label {
    color: rgba(255, 255, 255, 0.7);
  }

  input {
    color: white !important;
  }

  .v-field {
    border-color: rgba(255, 255, 255, 0.2);
  }
}

:deep(.v-btn) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

:deep(.v-alert) {
  background: rgba(244, 67, 54, 0.1) !important;
  color: white;
  border: 1px solid rgba(244, 67, 54, 0.2);
}
</style>
