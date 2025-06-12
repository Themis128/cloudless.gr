<template>
  <v-container fluid fill-height class="d-flex justify-center align-center">
    <LoginForm />
  </v-container>
</template>

<script setup>
import LoginForm from '@/components/auth/LoginForm.vue'
definePageMeta({ layout: 'auth' })
</script>

// Navigation is handled inside LoginForm.vue for all auth actions.
// LoginForm.vue should use:
//   navigateTo('/auth/reset') for forgot password
//   navigateTo('/auth/register') for register
//   navigateTo('/admin') for admin login
//   navigateTo('/dashboard') after successful login
