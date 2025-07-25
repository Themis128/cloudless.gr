<template>
<<<<<<< HEAD
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card>
          <v-card-title class="text-h4 text-center pa-6">
            Login
          </v-card-title>
          
          <v-card-text>
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                required
                :rules="[rules.required, rules.email]"
                prepend-icon="mdi-email"
                class="mb-4"
              />
              
              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                required
                :rules="[rules.required]"
                prepend-icon="mdi-lock"
                :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append="showPassword = !showPassword"
                class="mb-4"
                :style="{ '-webkit-text-security': showPassword ? 'none' : 'disc' }"
                autocomplete="current-password"
              />
              
              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :loading="loading"
                :disabled="!isFormValid"
              >
                Login
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
            <v-btn
              text
              color="primary"
              to="/auth/register"
              class="ml-2"
            >
              Register
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { login, getRedirectPath } = useAuth()
const router = useRouter()

const form = ref({
  email: '',
  password: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const rules = {
  required: (v: string) => !!v || 'This field is required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email'
}

const isFormValid = computed(() => {
  return form.value.email && 
         form.value.password && 
         /.+@.+\..+/.test(form.value.email)
})

const handleLogin = async () => {
  if (!isFormValid.value) return
  
  loading.value = true
  error.value = null
  
  try {
    console.log('Form data:', form.value)
    const result = await login({
      email: form.value.email,
      password: form.value.password
    })
    
    if (result.success) {
      // Get redirect path based on user role
      const redirectTo = result.user ? getRedirectPath(result.user) : '/dashboard'
      await router.push(redirectTo)
    } else {
      error.value = result.error || 'Login failed'
    }
  } catch (err: any) {
    console.error('Login error:', err)
    error.value = err.message || 'An error occurred during login'
  } finally {
    loading.value = false
  }
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
.v-text-field input[type="password"] {
  -webkit-text-security: disc;
  text-security: disc;
  color: #000000 !important;
}

.v-text-field input[type="text"] {
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
=======
  <div class="auth-container">
    <div class="auth-card">
      <h1>Login</h1>
      <p v-if="loginError" class="error-message">{{ loginError }}</p>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            v-model="email"
            required
            placeholder="Enter your email"
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            v-model="password"
            required
            placeholder="Enter your password"
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="auth-button" :disabled="isLoading">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <div class="auth-links">
        <p>Don't have an account? <NuxtLink to="/auth/signup">Sign up</NuxtLink></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';
import { useRoute, definePageMeta } from '#imports'
import { navigateTo } from '#app'

const { login, loginError, isLoading, isLoggedIn } = useUserAuth();

// Form state
const email = ref<string>('');
const password = ref<string>('');
const route = useRoute();

// Get redirect path from query parameter or default to dashboard
const redirectPath = computed<string>(() => {
  return route.query.redirect ? String(route.query.redirect) : '/dashboard';
});

// Redirect if already logged in
if (process.client && isLoggedIn.value) {
  await navigateTo(redirectPath.value);
}

// Handle login form submission
const handleLogin = async (): Promise<void> => {
  if (await login(email.value, password.value)) {
    // Redirect to original destination or dashboard if login successful
    await navigateTo(redirectPath.value);
  }
};

// Set page meta
definePageMeta({
  layout: 'default'
});
</script>

<style scoped>
.auth-container {
  min-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.auth-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

h1 {
  color: #1e40af;
  font-size: 1.8rem;
  text-align: center;
  margin-bottom: 1.5rem;
  font-weight: 700;
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: rgb(185, 28, 28);
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
}

input {
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #cbd5e1;
  background-color: white;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.auth-button {
  background-color: #1e40af;
  color: white;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 0.75rem;
}

.auth-button:hover {
  background-color: #1e3a8a;
}

.auth-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.auth-links {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.auth-links a {
  color: #2563eb;
  font-weight: 500;
  text-decoration: none;
}

.auth-links a:hover {
  text-decoration: underline;
}
</style>
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
