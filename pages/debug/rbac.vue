<template>
  <div class="rbac-debug-page">
    <RBACDebugDashboard />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/authStore'

definePageMeta({
  title: 'RBAC Debug Dashboard',
  middleware: 'auth'
})

// Check if user has admin permissions
const authStore = useAuthStore()

onMounted(() => {
  if (!authStore.isAdmin) {
    navigateTo('/dashboard')
  }
})
</script>

<style scoped>
.rbac-debug-page {
  min-height: 100vh;
}
</style> 