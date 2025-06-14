<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
    <v-card class="pa-6" elevation="8" max-width="420">
      <v-card-title class="text-h5 font-weight-bold mb-4">Login</v-card-title>
      <v-form @submit.prevent="handleLogin" ref="formRef" v-model="valid">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          :rules="[(v: string) => !!v || 'Email is required', (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid']"
          required
          class="mb-3"
          aria-label="Enter your email address"
        />
        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          :rules="[(v: string) => !!v || 'Password is required']"
          required
          class="mb-4"
          aria-label="Enter your password"
        />
        <v-btn
          type="submit"
          color="primary"
          block
          :loading="loading"
          :disabled="!valid || loading"
          aria-label="Submit the login form"
        >
          Login
        </v-btn>
        <v-alert v-if="error" type="error" class="mt-3" aria-live="assertive">
          {{ error }}
        </v-alert>
        <v-row justify="space-between" class="mt-4">
          <v-btn variant="text" @click="() => navigateTo('/auth/register')" aria-label="Go to the registration page">
            Register
          </v-btn>
          <v-btn variant="text" @click="() => navigateTo('/auth/reset')" aria-label="Go to the forgot password page">
            Forgot Password?
          </v-btn>
        </v-row>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

import { ref } from 'vue'
import { useNuxtApp, navigateTo } from 'nuxt/app'

const email = ref('')
const password = ref('')
const valid = ref(true)
const loading = ref(false)
const error = ref('')
const formRef = ref()

const { $supabase } = useNuxtApp()

async function handleLogin() {
  error.value = ''
  const isValid = await formRef.value?.validate()
  if (!isValid) return

  loading.value = true
  const { data, error: loginError } = await $supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  loading.value = false

  if (loginError) {
    if (loginError.status === 400) {
      error.value = 'Incorrect email or password.'
    } else {
      error.value = loginError.message || 'An error occurred. Please try again.'
    }
  } else if (data?.session) {
    await navigateTo('/dashboard')
  }
}
</script>

<style scoped>
.admin-title {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(90deg, #6366f1 0%, #60a5fa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  letter-spacing: 1px;
  text-align: center;
}
.admin-glass-card {
  background: rgba(255,255,255,0.10);
  box-shadow: 0 8px 32px 0 rgba(31,38,135,0.15);
  border-radius: 1.5rem;
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: background 0.3s;
}
:root.dark .admin-glass-card {
  background: rgba(30,41,59,0.25);
  border-color: rgba(255,255,255,0.10);
}
</style>
