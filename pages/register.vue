<template>
  <v-container class="fill-height d-flex flex-column justify-center align-center">
    <v-card class="pa-6" max-width="420" elevation="8">
      <h1 class="text-h5 font-weight-bold mb-4 text-primary">Create your account</h1>
      <RegisterForm />
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import RegisterForm from '@/components/auth/RegisterForm.vue'
definePageMeta({ layout: 'auth' })
</script>
