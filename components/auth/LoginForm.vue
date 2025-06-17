<template>
  <v-card class="glass-card pa-6" width="400" elevation="10">
    <v-card-title class="t  console.log('Login form submitted!')
  console.log('Email:', email.value)
  console.log('Email length:', email.value.length)
  console.log('Email char codes:', Array.from(email.value).map(c => c.charCodeAt(0)))
  console.log('Password length:', password.value.length)
  console.log('Password char codes:', Array.from(password.value).map(c => c.charCodeAt(0))) text-white text-center">Login</v-card-title>

    <v-form validate-on="submit lazy" @submit.prevent="handleLogin">
      <v-alert
        v-if="errorMsg"
        type="error"
        class="mb-4"
        border="start"
        prominent
      >
        {{ errorMsg }}
      </v-alert>
      <v-text-field
        v-model="email"
        label="Email"
        placeholder="you@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.email]"
        :disabled="loading"
      />

      <v-text-field
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        prepend-icon="mdi-lock-outline"
        :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input"
        :rules="[rules.required]"
        :disabled="loading"
        @click:append="showPassword = !showPassword"
      />

      <v-btn
        type="submit"
        block
        color="blue"
        class="mt-4"
        :loading="loading"
        :disabled="loading"
      >Login</v-btn>

      <v-btn
        variant="outlined"
        block
        color="blue"
        class="mt-2"
        to="/auth/admin-login"
        tag="router-link"
        :disabled="loading"
      >
        Login as Admin
      </v-btn>      <v-btn
        variant="text"
        block
        color="white"
        class="mt-4"
        :disabled="loading"
        @click="navigateTo('/auth/reset')"
      >
        Forgot Password?
      </v-btn>
    </v-form>

    <NuxtLink to="/auth/register" class="register-link mt-4">
      <v-icon left size="18" color="#a855f7">mdi-account-plus</v-icon>
      <span>Don’t have an account? <span class="gradient-text">Register</span></span>
    </NuxtLink>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo } from '#app'
import { useSupabase } from '@/composables/useSupabase'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const supabase = useSupabase()

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email'
}

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true
    console.log('🚀 Login form submitted!')
  console.log('📧 Email:', email.value)
  console.log('� Email length:', email.value.length)
  console.log('📧 Email char codes:', Array.from(email.value).map(c => c.charCodeAt(0)))
  console.log('�🔐 Password length:', password.value.length)
  console.log('🔐 Password char codes:', Array.from(password.value).map(c => c.charCodeAt(0)))
  
  try {
    // Use direct Supabase client instead of the complex auth composable
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    
    console.log('📊 Direct Supabase login response:', { data, error })
    
    if (error) {
      console.log('❌ Login error:', error)
      throw error
    }
    
    if (!data.user) {
      throw new Error('Login failed - no user data received')
    }
      console.log('✅ User authenticated:', data.user.email)
    
    // Redirect to users/index after successful login
    console.log('Redirecting to /users/index...')
    await navigateTo('/users/index')
    
  } catch (e: unknown) {
    console.error('[LOGIN] Error:', e)
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred'
    errorMsg.value = errorMessage || 'Login failed. Please check your credentials.'
    password.value = '' // Clear password on error
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.3);
}
.glass-input input {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
  /* Fix tab/letter spacing and padding for better alignment */
  letter-spacing: 0.02em;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: rgba(255,255,255,0.10) !important; /* semi-transparent */
  backdrop-filter: blur(2px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31,38,135,0.10);
}
.glass-input .v-field__overlay {
  background: transparent !important;
}
.v-label {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
}
::placeholder {
  color: #f3f6fa !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.35);
  opacity: 1;
}
.register-link {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 500;
  color: #3b82f6;
  gap: 0.4em;
  text-decoration: none;
  transition: color 0.2s;
}
.register-link:hover {
  color: #a855f7;
}
.gradient-text {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}
.glass-card .v-card-title, .glass-card .v-card-subtitle, .glass-card .v-btn, .glass-card .v-list-item-title, .glass-card .v-list-item-subtitle {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
}
</style>
