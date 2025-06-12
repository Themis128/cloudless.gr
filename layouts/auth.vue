<template>
  <VApp>
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

    <div class="content-container">
      <VMain class="main-content">
        <slot />
      </VMain>

      <client-only>
        <Suspense>
          <template #default>
            <Footer :year="new Date().getFullYear()" />
          </template>
          <template #fallback>
            <div class="footer-loading">Loading footer...</div>
          </template>
        </Suspense>
      </client-only>
    </div>
  </VApp>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import VantaBackground from '@/components/Base/VantaBackground.vue'

const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))
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

.content-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.footer-loading {
  text-align: center;
  font-size: 0.875rem;
  color: #aaa;
  padding: 0.75rem;
}
</style>
