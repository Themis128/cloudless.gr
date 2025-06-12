<template>
  <v-card class="glass-card pa-6" width="400" elevation="10">
    <v-card-title class="text-h5 text-white text-center">Login</v-card-title>

    <v-form @submit.prevent="handleLogin" validate-on="submit lazy">
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
      />

      <v-btn type="submit" block color="blue" class="mt-4">Login</v-btn>

      <v-btn
        variant="outlined"
        block
        color="blue"
        class="mt-2"
        @click="navigateTo('/admin')"
      >
        Login as Admin
      </v-btn>

      <v-btn
        variant="text"
        block
        color="white"
        class="mt-4"
        @click="navigateTo('/auth/reset')"
      >
        Forgot Password?
      </v-btn>

      <v-btn
        variant="text"
        block
        color="white"
        class="mt-1"
        @click="navigateTo('/auth/register')"
      >
        Register
      </v-btn>
    </v-form>

    <NuxtLink to="/auth/register" class="text-sm text-blue-700 block text-center mt-4">
      Don’t have an account? Register
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
const supabase = useSupabase()

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email'
}

async function handleLogin() {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  if (error) {
    alert(error.message)
  } else {
    navigateTo('/dashboard')
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
  color: white !important;
}
.v-label {
  color: rgba(255, 255, 255, 0.8);
}
</style>
