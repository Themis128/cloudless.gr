<template>
  <v-container fluid fill-height class="d-flex justify-center align-center">
    <AdminLogin />
  </v-container>
</template>

<script setup>
import AdminLogin from '@/components/auth/AdminLogin.vue'

definePageMeta({ layout: 'admin' })
</script>
