<template>
  <div class="default-layout">
    <div class="fallback-bg" aria-hidden="true" />
    <client-only>
      <Suspense>
        <template #default>
          <VantaBackground />
        </template>
      </Suspense>
    </client-only>
    <header class="header" role="banner">
      <component :is="isDesktop ? LargeNav : SmallNav" />
    </header>
    <main class="page-content" role="main">
      <LazyNuxtPage />
    </main>
    <Footer :year="currentYear" role="contentinfo" />
    <AccessibilityMenu />
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { defineAsyncComponent } from 'vue'

const currentYear = new Date().getFullYear()
const breakpoints = useBreakpoints({ md: 768 })
const isDesktop = breakpoints.greaterOrEqual('md')
const LargeNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/LargeNav.vue'))
const SmallNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/SmallNav.vue'))
const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))
const AccessibilityMenu = defineAsyncComponent(() => import('@/components/accessibility/AccessibilityMenu.vue'))
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
