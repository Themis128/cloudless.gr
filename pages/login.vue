<template>
  <div class="login-page">
    <LoginForm @success="handleLoginSuccess" @error="handleLoginError" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

definePageMeta({
  title: 'Login',
  layout: 'auth',
})

// Auth store
const authStore = useAuthStore()

// Get redirect parameter from URL
const route = useRoute()
const redirectPath = route.query.redirect as string

// Redirect if already authenticated
onMounted(() => {
  if (authStore.isAuthenticated && authStore.user) {
    // Use redirect parameter if available, otherwise use role-based redirect
    const targetPath = redirectPath || authStore.getRedirectPath(authStore.user)
    navigateTo(targetPath)
  }
})

// Methods
const handleLoginSuccess = (user: any) => {
  console.log('Login successful:', user)

  // Use redirect parameter if available, otherwise use role-based redirect
  const targetPath = redirectPath || authStore.getRedirectPath(user)
  navigateTo(targetPath)
}

const handleLoginError = (error: string) => {
  console.error('Login error:', error)
  // Error notification could be added here
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
