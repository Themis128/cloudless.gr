<template>
  <client-only>
    <Suspense>
      <template #default>
        <VantaBackground />
      </template>
      <template #fallback>
        <div class="fallback-bg" />
      </template>
    </Suspense>
  </client-only>
  <div class="login-center-wrapper">
    <LoginForm />
  </div>
</template>

<script setup>
import LoginForm from '@/components/auth/LoginForm.vue'
import VantaBackground from '@/components/Base/VantaBackground.vue'
definePageMeta({ layout: 'auth' })
</script>

<style scoped>
.fallback-bg {
  height: 100vh;
  width: 100vw;
  background-color: #7ec0ee;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
}
.vanta-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.login-center-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}
</style>

// Navigation is handled inside LoginForm.vue for all auth actions.
// LoginForm.vue should use:
//   navigateTo('/auth/reset') for forgot password
//   navigateTo('/auth/register') for register
//   navigateTo('/admin') for admin login
//   navigateTo('/dashboard') after successful login
