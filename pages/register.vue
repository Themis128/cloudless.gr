<template>
  <div class="register-page">
    <RegisterForm 
      @success="handleRegisterSuccess"
      @error="handleRegisterError"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/authStore'

definePageMeta({
  title: 'Register',
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
const handleRegisterSuccess = (user: any) => {
  console.log('Registration successful:', user)
  // Success notification could be added here
}

const handleRegisterError = (error: string) => {
  console.error('Registration error:', error)
  // Error notification could be added here
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style> 