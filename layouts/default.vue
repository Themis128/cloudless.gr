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
    </Suspense>    <Suspense>
      <template #default>
        <AccessibilityMenu />
      </template>
    </Suspense>

    <!-- Floating Navigation Button -->
    <Suspense>
      <template #default>
        <FloatingNavButton />
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
const FloatingNavButton = defineAsyncComponent(() => import('@/components/ui/FloatingNavButton.vue'))
</script>

<style scoped>
.fallback-bg {
  position: fixed;
  top: -300px;   /* Match VantaBackground positioning */
  left: -100px;
  right: -100px;
  bottom: -100px;
  width: calc(100vw + 200px);
  height: calc(100vh + 400px);
  background: linear-gradient(135deg, #16213e 0%, #1a365d 25%, #2d3748 50%, #1a202c 75%, #16213e 100%);
  z-index: 0;
  transform: scale(1.3) translateY(-60px); /* Match VantaBackground transform */
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
