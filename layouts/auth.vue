<template>
  <div class="layout">
    <!-- Animated Vanta Background -->
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

    <Suspense>
      <template #default>
        <AccessibilityMenu />
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import VantaBackground from '@/components/Base/VantaBackground.vue'

const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))
const LargeNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/LargeNav.vue'))
const AccessibilityMenu = defineAsyncComponent(() => import('@/components/accessibility/AccessibilityMenu.vue'))
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
