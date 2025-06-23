<template>
  <div class="auth-container">
    <LoginForm /> <!-- LoginForm Component -->
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, onMounted } from 'vue';
import LoginForm from '~/components/auth/LoginForm.vue';

definePageMeta({
  layout: 'auth'
})

// Verbose debugging and logging for /auth page
onMounted(() => {
  if (process.client) {
    console.log('[DEBUG] /auth page loaded');
    try {
      // Only log non-sensitive info
      console.log('[DEBUG] SUPABASE_URL:', process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL);
      console.log('[DEBUG] SUPABASE_ANON_KEY length:', (process.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').length);
    } catch (e) {
      console.error('[DEBUG] Error logging env vars:', e);
    }
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[DEBUG] Unhandled Promise rejection:', event.reason);
    });
    window.addEventListener('error', (event) => {
      console.error('[DEBUG] Window error:', event.error || event.message);
    });
  }
});

onErrorCaptured((err, instance, info) => {
  console.error('[DEBUG] Vue error captured on /auth:', err, info);
  return false;
});
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); /* More pronounced shadow */
  padding: 2rem;
  transition: box-shadow 0.3s ease;
  position: relative;
}

.glass-card:hover {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4); /* Hover effect for a bigger shadow */
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

/* Optional: Style the title text for better visibility on darker backgrounds */
.text-h5 {
  font-weight: bold;
}

/* Optional: Extra margin for smaller devices */
@media (max-width: 600px) {
  .glass-card {
    padding: 1.5rem;
  }
}
</style>
