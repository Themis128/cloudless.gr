<template>
  <v-card class="elegant-admin-card pa-8" width="420" elevation="16">
    <v-card-title class="text-h5 text-center font-weight-bold mb-2 gradient-title">
      <v-icon color="primary" size="32" class="mr-2">mdi-shield-account</v-icon>
      Admin Login
    </v-card-title>
    <v-divider class="mb-6" />

    <!-- Display error messages from URL params -->
    <v-alert
      v-if="urlError"
      type="error"
      class="mb-4"
      border="start"
      prominent
    >
      {{ getErrorMessage(urlError) }}
    </v-alert>

    <v-form validate-on="submit lazy" @submit.prevent="handleAdminLogin">
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
        clearable
        variant="solo-inverted"
        color="primary"
        class="elegant-input mb-2"
        :rules="[rules.required]"
        :disabled="loading"
        @click:append="showPassword = !showPassword"
      />
      <v-btn
        type="submit"
        block
        color="primary"
        class="mt-4 gradient-btn"
        size="large"
        :loading="loading"
        :disabled="loading"
      >
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

useSupabaseAuth()

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
    // Check if account is locked before attempting login
    const supabase = useSupabaseClient()

    const { data: lockCheck } = await supabase
      .from('profiles')
      .select('locked_until, failed_login_attempts, role, is_active')
      .eq('email', email.value)
      .single()

    if (lockCheck?.locked_until) {
      const lockTime = new Date(lockCheck.locked_until)
      const now = new Date()

      if (lockTime > now) {
        throw new Error('Admin account is temporarily locked due to multiple failed login attempts. Please try again later.')
      }
    }

    // Check if user exists and has admin role
    if (lockCheck && lockCheck.role !== 'admin') {
      throw new Error('Access denied. Admin privileges required.')
    }

    if (lockCheck && !lockCheck.is_active) {
      throw new Error('Admin account is deactivated. Please contact system administrator.')
    }

    // Attempt login with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    console.log('📊 Admin login response:', { data, error })

    if (error) {
      console.log('❌ Admin login error:', error)

      // Increment failed login attempts
      const currentAttempts = lockCheck?.failed_login_attempts || 0
      const newAttempts = currentAttempts + 1
      const maxAttempts = 3 // Stricter for admin accounts

      const updateData = {
        failed_login_attempts: newAttempts,
        updated_at: new Date().toISOString(),
        ...(newAttempts >= maxAttempts && {
          locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes for admin
        })
      }

      // Update profile with failed attempt
      await supabase
        .from('profiles')
        .update(updateData)
        .eq('email', email.value)

      throw error
    }

    if (!data.user) {
      throw new Error('Admin login failed - no user data received')
    }

    console.log('✅ Admin authenticated:', data.user.email)

    // Reset failed login attempts on successful login
    await supabase
      .from('profiles')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('email', email.value)

    // Double-check admin role after login
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      await supabase.auth.signOut()
      throw new Error('Admin access denied. Invalid role.')
    }

    if (!profile.is_active) {
      await supabase.auth.signOut()
      throw new Error('Admin account is deactivated.')
    }

    console.log('Redirecting to admin dashboard...')
    await navigateTo('/admin/')

  } catch (e: unknown) {
    console.error('[ADMIN LOGIN] Error:', e)
    const errorMessage = e instanceof Error ? e.message : 'Admin login failed'
    errorMsg.value = errorMessage
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
