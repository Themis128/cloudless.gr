<template>
  <div class="auth-container">
    <div class="auth-wrapper">
      <LoginForm />
    </div>
  </div>
</template>

<script setup lang="ts">
import LoginForm from '@/components/auth/LoginForm.vue';
import { definePageMeta } from '#imports';

definePageMeta({
  layout: 'auth'
})
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 16px;
  width: 100%;
}

.auth-wrapper {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .auth-container {
    padding: 12px;
    align-items: flex-start;
    padding-top: 5vh;
  }
  
  .auth-wrapper {
    max-width: 100%;
  }
}

@media (max-width: 360px) {
  .auth-container {
    padding: 8px;
    padding-top: 3vh;
  }
}

.glass-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  padding: 2rem;
  transition: box-shadow 0.3s ease;
  position: relative;
}

.glass-card:hover {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
}

.v-btn {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.v-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

.v-snackbar {
  z-index: 1000;
}
</style>
