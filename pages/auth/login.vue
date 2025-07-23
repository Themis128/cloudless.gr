<template>
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