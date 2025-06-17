<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
    <v-card class="pa-6" elevation="8" max-width="420">
      <v-card-title class="text-h5 font-weight-bold mb-4">Admin Login</v-card-title>
      <v-form ref="formRef" v-model="valid" @submit.prevent="handleLogin">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          :rules="[
            (v: string) => !!v || 'Email is required',
            (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid'
          ]"
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
          aria-label="Sign in to admin account"
        >
          Sign In
        </v-btn>
        <v-btn
          variant="text"
          color="secondary"
          class="mt-2"
          :to="{ path: '/auth/reset' }"
          aria-label="Forgot password?"
          tabindex="0"
        >
          Forgot password?
        </v-btn>
        <v-alert
          v-if="error"
          type="error"
          class="mt-3"
          aria-live="assertive"
        >{{ error }}</v-alert>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

import { ref } from 'vue'
import { useNuxtApp } from 'nuxt/app'

const email = ref('')
const password = ref('')
const error = ref('')
const valid = ref(true)
const loading = ref(false)
const formRef = ref()

const { $supabase } = useNuxtApp()

async function handleLogin() {
  error.value = ''
  loading.value = true
  const validationResult = await formRef.value?.validate?.()
  const isValid = typeof validationResult === 'object' ? validationResult.valid : validationResult
  if (!isValid) {
    loading.value = false
    return
  }
  const { data, error: authError } = await $supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (authError) {
    password.value = ''
    if (authError.status === 400) {
      error.value = 'Invalid email or password.'
    } else {
      error.value = authError?.message || 'Something went wrong. Please try again.'
    }
    return
  }
  if (data.session) {
    await navigateTo('/admin/dashboard')
  }
}
</script>
