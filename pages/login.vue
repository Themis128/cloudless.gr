<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Login</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="email"
                label="Email"
                name="email"
                prepend-icon="mdi-email"
                type="email"
                required
                :error-messages="emailError"
                @input="emailError = ''"
              />
              <v-text-field
                v-model="password"
                label="Password"
                name="password"
                prepend-icon="mdi-lock"
                type="password"
                required
                :error-messages="passwordError"
                @input="passwordError = ''"
              />

              <v-alert
                v-if="error"
                type="error"
                class="mb-4"
                variant="tonal"
              >
                {{ error }}
              </v-alert>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              @click="handleLogin"
              :loading="isLoading"
            >
              Login
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from '#imports'
import { navigateTo } from 'nuxt/app'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default',
  auth: false
})

const email = ref('')
const password = ref('')
const emailError = ref('')
const passwordError = ref('')
const error = ref('')

const { login, isLoading } = useAuth()

const handleLogin = async () => {
  // Clear previous errors
  emailError.value = ''
  passwordError.value = ''
  error.value = ''

  // Validate fields
  if (!email.value) {
    emailError.value = 'Email is required'
    return
  }

  if (!password.value) {
    passwordError.value = 'Password is required'
    return
  }

  try {
    const success = await login(email.value, password.value)
    if (success) {
      await navigateTo('/dashboard')
    }
  } catch (err: any) {
    error.value = err.message || 'Login failed. Please try again.'
    console.error('Login failed:', err)
  }
}
</script>
