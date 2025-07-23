<template>
  <div class="profile-page">
    <div class="page-header">
      <h1>User Profile</h1>
      <p>Manage your account settings and preferences</p>
    </div>
    
    <UserProfile 
      :user="authStore.user"
      @updated="handleProfileUpdated"
      @error="handleProfileError"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/authStore'

definePageMeta({
  title: 'Profile',
  middleware: 'auth'
})

// Auth store
const authStore = useAuthStore()

// Redirect if not authenticated
onMounted(() => {
  if (!authStore.isAuthenticated) {
    navigateTo('/login')
  }
})

// Methods
const handleProfileUpdated = (user: any) => {
  console.log('Profile updated:', user)
  // Success notification could be added here
}

const handleProfileError = (error: string) => {
  console.error('Profile error:', error)
  // Error notification could be added here
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.01) 0%, rgba(248, 250, 252, 0.01) 100%);
  backdrop-filter: blur(6.5px);
}

.page-header {
  text-align: center;
  padding: 3rem 2rem 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-header p {
  color: #64748b;
  font-size: 1.125rem;
  margin: 0;
  font-weight: 500;
}

@media (max-width: 768px) {
  .page-header {
    padding: 2rem 1rem 1rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .page-header p {
    font-size: 1rem;
  }
}
</style> 