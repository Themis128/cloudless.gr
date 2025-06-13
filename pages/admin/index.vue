<template>
  <h2 class="admin-title text-center mt-8 mb-4">Cloudless Admin</h2>
  <v-container fluid fill-height class="d-flex justify-center align-center flex-column">
    <AdminLogin />
    <v-btn color="primary" class="mt-6" to="/auth/login" size="large" variant="outlined">
      <v-icon left>mdi-account</v-icon>
      User Login
    </v-btn>
  </v-container>
</template>

<script setup>
import AdminLogin from '@/components/auth/AdminLogin.vue'

definePageMeta({ layout: 'admin' })
</script>

<style scoped>
.admin-title {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
  text-shadow: 0 2px 16px rgba(80,80,160,0.13);
}
</style>
