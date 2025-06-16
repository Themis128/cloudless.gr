<template>
  <v-card class="elegant-admin-card pa-8" width="420" elevation="16">
    <v-card-title class="text-h5 text-center font-weight-bold mb-2 gradient-title">
      <v-icon color="primary" size="32" class="mr-2">mdi-shield-account</v-icon>
      Admin Login
    </v-card-title>
    <v-divider class="mb-6" />
    
    <!-- Display error messages from URL params -->
    <v-alert v-if="urlError" type="error" class="mb-4" border="start" prominent>
      {{ getErrorMessage(urlError) }}
    </v-alert>
    
    <v-form @submit.prevent="handleAdminLogin" validate-on="submit lazy">
      <v-alert v-if="errorMsg" type="error" class="mb-4" border="start" prominent>
        {{ errorMsg }}
      </v-alert>
      <v-text-field
        v-model="email"
        label="Admin Email"
        aria-label="Admin email"
        placeholder="admin@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="primary"
        class="elegant-input mb-4"
        :rules="[rules.required, rules.email]"
        :disabled="loading"
      />
      <v-text-field
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        aria-label="Admin password"
        prepend-icon="mdi-lock-outline"
        :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        @click:append="showPassword = !showPassword"
        clearable
        variant="solo-inverted"
        color="primary"
        class="elegant-input mb-2"
        :rules="[rules.required]"
        :disabled="loading"
      />
      <v-btn type="submit" block color="primary" class="mt-4 gradient-btn" size="large" :loading="loading" :disabled="loading">
        <v-icon left>mdi-login</v-icon>
        Login as Admin
      </v-btn>
      
      <v-btn
        variant="text"
        block
        color="primary"
        class="mt-3"
        to="/auth"
        :disabled="loading"
      >
        <v-icon left size="18">mdi-arrow-left</v-icon>
        Back to User Login
      </v-btn>
    </v-form>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { navigateTo, useRoute } from '#app'

const route = useRoute()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const urlError = ref('')

const { signIn } = useSupabaseAuth()

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email'
}

const getErrorMessage = (error: string) => {
  const errorMessages: { [key: string]: string } = {
    'unauthorized': 'You are not authorized to access the admin panel.',
    'login_required': 'Please log in to access the admin panel.',
    'system_error': 'A system error occurred. Please try again.',
  }
  return errorMessages[error] || 'An unknown error occurred.'
}

onMounted(() => {
  // Check for error parameter in URL
  if (route.query.error) {
    urlError.value = route.query.error as string
  }
})

async function handleAdminLogin() {
  errorMsg.value = ''
  urlError.value = ''
  loading.value = true
  
  try {
    // Use the enhanced signIn method with admin role requirement
    await signIn(email.value, password.value, true)
    
    // Success: redirect to admin dashboard
    await navigateTo('/admin/')
  } catch (error: any) {
    console.error('[ADMIN LOGIN] Error:', error)
    errorMsg.value = error.message || 'Admin login failed. Please check your credentials.'
    password.value = '' // Clear password on error
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.elegant-admin-card {
  background: rgba(30, 32, 48, 0.3); /* Reduced opacity from 0.95 to 0.3 */
  border-radius: 22px;
  box-shadow: 0 12px 40px 0 rgba(40, 40, 80, 0.15), 0 1.5px 8px 0 rgba(80, 80, 160, 0.08);
  backdrop-filter: blur(20px); /* Increased blur for better glass effect */
  -webkit-backdrop-filter: blur(20px);
  color: #f3f3f3;
  border: 1.5px solid rgba(255, 255, 255, 0.1); /* More transparent border */
}
.gradient-title {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  align-items: center;
  justify-content: center;
}
.elegant-input input {
  color: #f3f3f3 !important;
  background: transparent !important; /* Make input completely transparent */
  border-radius: 8px !important;
}
.elegant-input .v-field__overlay {
  background: transparent !important; /* Make field overlay transparent */
}
.elegant-input .v-field {
  background: rgba(255, 255, 255, 0.05) !important; /* Very subtle field background */
  border: 1px solid rgba(255, 255, 255, 0.1) !important; /* Subtle border */
}
.v-label {
  color: #e0e0e0 !important; /* Brighter labels for better visibility */
}
.gradient-btn {
  background: linear-gradient(90deg, #3b82f6 0%, #a855f7 100%) !important;
  color: #fff !important;
  font-weight: 600;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 160, 0.2);
}
</style>
