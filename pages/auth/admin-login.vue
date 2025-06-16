<template>
  <div class="auth-container">
    <AdminLogin /> <!-- AdminLogin Component -->
  </div>
</template>

<script setup lang="ts">
import AdminLogin from '~/components/auth/AdminLogin.vue'

// Use the auth layout to match other auth pages
definePageMeta({ layout: 'auth' })
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}
</style>
