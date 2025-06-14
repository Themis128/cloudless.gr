<template>
  <div class="login-page">
    <div class="fallback-bg" aria-hidden="true" />
    <client-only>
      <Suspense>
        <template #default>
          <LoginForm />
        </template>
        <template #fallback>
          <div class="text-center py-10 text-white">Loading login form…</div>
        </template>
      </Suspense>
      <Suspense>
        <template #default>
          <VantaBackground />
        </template>
      </Suspense>
    </client-only>
  </div>
</template>

<script setup lang="ts">
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
