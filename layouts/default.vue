<template>
  <div class="layout-root">
    <VantaBackground />
    <!-- <ThreeSkyBackground /> -->
    <header class="main-header header-transparent">
      <div class="container mx-auto flex items-center justify-between">
        <NuxtLink
          to="/"
          class="logo-link font-extrabold text-2xl tracking-tight text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2 py-1 hover:bg-indigo-50 transition uppercase"
          aria-label="Go to homepage"
        >
          Cloudless
        </NuxtLink>
        <client-only>
          <LargeNav v-if="isDesktop" />
          <SmallNav v-else />
        </client-only>
        <slot name="header" />
      </div>
    </header>
    <main
      class="container mx-auto px-4 py-8 main-content-transparent"
      style="position: relative; z-index: 1"
    >
      <slot />
    </main>
    <Footer />
  </div>
</template>

<script setup>
import VantaBackground from '@/components/Base/VantaBackground.vue';
import Footer from '@/components/Layout/Footer.vue';
import LargeNav from '@/components/Layout/Navigation/LargeNav.vue';
import SmallNav from '@/components/Layout/Navigation/SmallNav.vue';
import { useBreakpoints } from '@vueuse/core';
const year = new Date().getFullYear();
const breakpoints = useBreakpoints({ md: 768 });
const isDesktop = breakpoints.greaterOrEqual('md');
</script>

<style scoped>
.layout-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.main-header.header-transparent {
  background: transparent !important;
  box-shadow: none !important;
  color: inherit;
}

footer {
  background: transparent !important;
  color: #1e293b;
  font-weight: 700;
  letter-spacing: 0.01em;
  font-family: inherit;
  flex-shrink: 0;
  z-index: 10;
  position: relative;
}

.main-content-transparent {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  color: #1e293b;
  font-weight: 700;
  letter-spacing: 0.01em;
  font-family: inherit;
}

.background-3d {
  display: none;
}

.logo-link {
  font-family: 'Montserrat', 'Inter', 'Segoe UI', Arial, sans-serif;
  font-size: 2.3rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #c2c6d4ad !important;
  background: linear-gradient(90deg, #1e40af 30%, #2563eb 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  box-shadow: none !important;
  border: none !important;
  transition:
    color 0.18s,
    background 0.18s,
    text-shadow 0.18s;
  cursor: pointer;
  z-index: 30;
  position: relative;
  line-height: 1.1;
  text-shadow:
    0 2px 16px rgba(30, 64, 175, 0.1),
    0 1px 2px rgba(37, 99, 235, 0.08);
}

.logo-link:hover {
  background: linear-gradient(90deg, #2563eb 10%, #1e40af 90%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow:
    0 4px 24px rgba(30, 64, 175, 0.18),
    0 2px 8px rgba(37, 99, 235, 0.12);
}
</style>
