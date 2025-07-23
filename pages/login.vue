<template>
  <div class="login-page">
    <LoginForm 
      @success="handleLoginSuccess"
      @error="handleLoginError"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/authStore'

definePageMeta({
  title: 'Login',
  layout: 'auth'
})

// Auth store
const authStore = useAuthStore()

// Redirect if already authenticated
onMounted(() => {
  if (authStore.isAuthenticated) {
    if (authStore.isAdmin) {
      navigateTo('/admin/users')
    } else {
      navigateTo('/dashboard')
    }
  }
})

// Methods
const handleLoginSuccess = (user: any) => {
  console.log('Login successful:', user)
  // Success notification could be added here
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