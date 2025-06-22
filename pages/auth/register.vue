<template>
  <v-container fluid fill-height class="auth-container d-flex justify-center align-center">
    <div class="auth-wrapper">
      <RegisterForm />
    </div>
  </v-container>
</template>

<script setup lang="ts">
import RegisterForm from '@/components/auth/RegisterForm.vue';
definePageMeta({ layout: 'auth' })
</script>

<style scoped>
:deep(html),
:deep(body),
:deep(#__nuxt) {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.auth-wrapper {
  width: 100%;
  max-width: 450px;
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
</style>
