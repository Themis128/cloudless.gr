<template>
  <v-container fluid fill-height class="d-flex justify-center align-center">
    <v-row class="w-100" justify="center">
      <v-col cols="12" md="6" lg="4">
        <h2 class="text-h5 font-weight-bold text-center mb-6">Admin Login</h2>
        <AdminLogin />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import AdminLogin from '@/components/auth/AdminLogin.vue'

definePageMeta({ layout: 'admin' })
</script>
