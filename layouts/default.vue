<template>
  <VApp class="layout">
    <!-- Animated Vanta Background -->
    <ClientOnly>
      <Suspense>
        <template #default>
          <VantaBackground />
        </template>
        <template #fallback>
          <div class="fallback-bg" />
        </template>
      </Suspense>
    </ClientOnly>
    
    <!-- Navigation -->
    <LargeNav class="header" />

    <!-- Main Content Area -->
    <VMain
      id="main-content"
      role="main"
      class="page-content"
      tabindex="-1"
    >
      <NuxtPage />
    </VMain>

    <!-- Footer with Suspense -->
    <Suspense>
      <template #default>
        <Footer :year="new Date().getFullYear()" />
      </template>
      <template #fallback>
        <VContainer class="text-center py-2">
          <VProgressCircular 
            indeterminate 
            size="16" 
            width="2"
            class="mr-2"
          />
          <span class="text-caption">Loading footer...</span>
        </VContainer>
      </template>
    </Suspense>
    
    <!-- Accessibility Menu -->
    <Suspense>
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
  </VApp>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Lazy load components for better performance
const VantaBackground = defineAsyncComponent(() => import('@/components/Base/VantaBackground.vue'))
const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))
const LargeNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/LargeNav.vue'))
const AccessibilityMenu = defineAsyncComponent(
  () => import('@/components/accessibility/AccessibilityMenu.vue')
)
const FloatingNavButton = defineAsyncComponent(
  () => import('@/components/ui/FloatingNavButton.vue')
)
</script>

<style scoped>
.fallback-bg {
  position: fixed;
  top: -300px;
  left: -100px;
  right: -100px;
  bottom: -100px;
  width: calc(100vw + 200px);
  height: calc(100vh + 400px);
  background: linear-gradient(
    135deg,
    #16213e 0%,
    #1a365d 25%,
    #2d3748 50%,
    #1a202c 75%,
    #16213e 100%
  );
  z-index: 0;
  transform: scale(1.3) translateY(-60px);
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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  flex-shrink: 0;
  z-index: 1;
}

.page-content {
  flex: 1;
  position: relative;
  z-index: 1;
}

/* Improved responsive design */
@media (max-width: 768px) {
  .fallback-bg {
    transform: scale(1.5) translateY(-40px);
  }
}

@media (max-width: 480px) {
  .fallback-bg {
    transform: scale(1.8) translateY(-20px);
  }
}
</style>
