<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
    <v-card class="pa-6" elevation="8" max-width="420">
      <v-card-title class="text-h5 font-weight-bold mb-4">Reset Password</v-card-title>
      <v-form @submit.prevent="handleReset" ref="formRef" v-model="valid">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          :rules="[
            (v: string) => !!v || 'Email is required',
            (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid'
          ]"
          required
          class="mb-4"
        />
        <v-btn type="submit" color="primary" block :loading="loading" :disabled="!valid || loading">
          Send Reset Link
        </v-btn>
        <v-alert v-if="message" type="success" class="mt-4" aria-live="polite">{{ message }}</v-alert>
        <v-alert v-if="error" type="error" class="mt-4" aria-live="assertive">{{ error }}</v-alert>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

import { ref } from 'vue'
import { useNuxtApp } from 'nuxt/app'

const email = ref('')
const error = ref('')
const message = ref('')
const valid = ref(true)
const loading = ref(false)
const formRef = ref()
const { $supabase } = useNuxtApp()

async function handleReset() {
  error.value = ''
  message.value = ''
  const isValid = await formRef.value?.validate()
  if (!isValid) return
  loading.value = true
  const { error: resetError } = await $supabase.auth.resetPasswordForEmail(email.value)
  loading.value = false
  if (resetError) {
    error.value = resetError.message
  } else {
    message.value = 'Password reset link sent to your email.'
  }
}
</script>
