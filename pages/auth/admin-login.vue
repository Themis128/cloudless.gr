<template>
  <v-card class="pa-6" elevation="8">
    <v-form @submit.prevent="handleLogin" ref="form" v-model="valid" lazy-validation>
      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        :rules="emailRules"
        required
      />

      <v-text-field
        v-model="password"
        label="Password"
        type="password"
        :rules="passwordRules"
        required
      />

      <v-btn :loading="loading" type="submit" block color="primary" class="my-4">
        Login
      </v-btn>

      <v-alert v-if="errorMsg" type="error" dense class="mt-2" aria-live="assertive">
        {{ errorMsg }}
      </v-alert>

      <v-row justify="space-between" class="mt-4">
        <v-btn text @click="navigateToRegister">Register</v-btn>
        <v-btn text @click="navigateToForgot">Forgot Password?</v-btn>
      </v-row>
    </v-form>
  </v-card>
</template>

<script setup lang="ts">
// Optional: definePageMeta({ layout: 'default' })

import { ref, type Ref } from 'vue'
import { navigateTo, useNuxtApp } from '#app'

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
const valid = ref(false)
const form = ref<InstanceType<typeof import('vuetify/components').VForm> | null>(null)

const { $supabase } = useNuxtApp()

const emailRules = [
  (v: string) => !!v || 'Email is required',
  (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid',
]
const passwordRules = [(v: string) => !!v || 'Password is required']

async function handleLogin() {
  errorMsg.value = ''
  const isValid = await form.value?.validate?.()
  if (!isValid) return

  loading.value = true
  const { error } = await $supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    password.value = ''
    return
  }

  await navigateTo('/dashboard')
}

function navigateToRegister() {
  navigateTo('/auth/register')
}

function navigateToForgot() {
  navigateTo('/auth/reset')
}
</script>
