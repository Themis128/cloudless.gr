<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
    <v-card class="pa-6" elevation="8" max-width="420">
      <v-card-title class="text-h5 font-weight-bold mb-4">Register</v-card-title>
      <v-form @submit.prevent="handleRegister" ref="formRef" v-model="valid">
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
          class="mb-3"
        />
        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          autocomplete="new-password"
          :rules="[(v: string) => !!v || 'Password is required']"
          required
          class="mb-4"
        />
        <v-btn type="submit" color="primary" block :loading="loading" :disabled="!valid || loading">
          Create Account
        </v-btn>
        <v-alert v-if="message" type="success" class="mt-4">{{ message }}</v-alert>
        <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
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
const valid = ref(true)
const formRef = ref()
const error = ref('')
const message = ref('')
const loading = ref(false)
const { $supabase } = useNuxtApp()

async function handleRegister() {
  error.value = ''
  message.value = ''
  const isValid = await formRef.value?.validate()
  if (!isValid) return
  loading.value = true
  const { error: signupError } = await $supabase.auth.signUp({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (signupError) {
    error.value = signupError.message
  } else {
    message.value = 'Check your email to confirm your account.'
    email.value = ''
    password.value = ''
  }
}
</script>
