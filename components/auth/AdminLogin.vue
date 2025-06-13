<template>
  <v-card class="elegant-admin-card pa-8" width="420" elevation="16">
    <v-card-title class="text-h5 text-center font-weight-bold mb-2 gradient-title">
      <v-icon color="primary" size="32" class="mr-2">mdi-shield-account</v-icon>
      Admin Login
    </v-card-title>
    <v-divider class="mb-6" />
    <v-form @submit.prevent="handleAdminLogin" validate-on="submit lazy">
      <v-text-field
        v-model="email"
        label="Admin Email"
        placeholder="admin@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="primary"
        class="elegant-input mb-4"
        :rules="[rules.required, rules.email]"
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
        color="primary"
        class="elegant-input mb-2"
        :rules="[rules.required]"
      />
      <v-btn type="submit" block color="primary" class="mt-4 gradient-btn" size="large">
        <v-icon left>mdi-login</v-icon>
        Login as Admin
      </v-btn>
    </v-form>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSupabase } from '@/composables/useSupabase'
import { navigateTo } from '#app'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const supabase = useSupabase()

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email'
}

async function handleAdminLogin() {
  // Query the admins table for the email
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email.value)
    .single()

  if (error || !data) {
    alert('Admin not found or error: ' + (error?.message || ''))
    return
  }

  // For demo: compare plaintext password (in production, use hashing!)
  if (data.password === password.value) {
    navigateTo('/admin')
  } else {
    alert('Invalid password')
  }
}
</script>

<style scoped>
.elegant-admin-card {
  background: rgba(30, 32, 48, 0.95);
  border-radius: 22px;
  box-shadow: 0 12px 40px 0 rgba(40, 40, 80, 0.25), 0 1.5px 8px 0 rgba(80, 80, 160, 0.10);
  backdrop-filter: blur(18px);
  color: #f3f3f3;
  border: 1.5px solid rgba(80, 80, 160, 0.13);
}
.gradient-title {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}
.elegant-input input {
  color: #f3f3f3 !important;
  background: rgba(40, 40, 80, 0.13) !important;
  border-radius: 8px !important;
}
.v-label {
  color: #bdbdfc !important;
}
.gradient-btn {
  background: linear-gradient(90deg, #3b82f6 0%, #a855f7 100%) !important;
  color: #fff !important;
  font-weight: 600;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 160, 0.13);
}
</style>
