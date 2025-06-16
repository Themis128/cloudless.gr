<template>
  <v-card class="glass-card pa-6" width="400" elevation="10">
    <v-card-title class="text-h5 text-white text-center">Login</v-card-title>

    <v-form @submit.prevent="handleLogin" validate-on="submit lazy">
      <v-alert v-if="errorMsg" type="error" class="mb-4" border="start" prominent>
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
        @click:append="showPassword = !showPassword"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input"
        :rules="[rules.required]"
        :disabled="loading"
      />

      <v-btn type="submit" block color="blue" class="mt-4" :loading="loading" :disabled="loading">Login</v-btn>

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
        @click="navigateTo('/auth/reset')"
        :disabled="loading"
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
import { useSupabase, setupUserStorage } from '@/composables/useSupabase'

const route = useRoute()
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
  
  try {
    const { signIn } = useSupabaseAuth()
    
    // Use the enhanced signIn method (non-admin)
    const data = await signIn(email.value, password.value, false)
    
    if (!data.user) {
      throw new Error('Login failed - no user data received')
    }
    
    // Setup user storage
    try {
      const userId = data.user.id
      if (userId) {
        await setupUserStorage(supabase, userId)
      }
    } catch (e) {
      console.warn('Storage setup failed:', e)
      // Don't fail login for storage setup issues
    }
    
    // Ensure session is set before redirecting
    let sessionReady = false
    for (let i = 0; i < 10; i++) {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session) {
        sessionReady = true
        break
      }
      await new Promise(res => setTimeout(res, 100))
    }
    
    if (sessionReady) {
      // Check if there's a redirect parameter
      const redirectTo = route.query.redirect as string
      if (redirectTo && redirectTo !== '/auth' && redirectTo !== '/auth/login') {
        await navigateTo(redirectTo)
      } else {
        await navigateTo('/users/index')
      }
    } else {
      errorMsg.value = 'Login session could not be established. Please try again.'
    }
    
  } catch (e: any) {
    console.error('[LOGIN] Error:', e)
    errorMsg.value = e.message || 'Login failed. Please check your credentials.'
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
