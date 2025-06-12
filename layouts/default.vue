<template>
  <div class="layout">
    <LargeNav class="header" />

    <main class="page-content">
      <NuxtPage />
    </main>

    <Suspense>
      <template #default>
        <Footer :year="new Date().getFullYear()" />
      </template>
      <template #fallback>
        <div class="text-sm text-gray-400 text-center py-2">Loading footer...</div>
      </template>
    </Suspense>
  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'

const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))
const LargeNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/LargeNav.vue'))
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  flex-shrink: 0;
}

.page-content {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}
</style>
