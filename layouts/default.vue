<template>
  <v-app>
    <!-- Vanta.js Clouds2 Background -->
    <VantaClouds2Background />

    <v-app-bar color="primary" dark app elevation="2" class="transparent-overlay">
      <v-toolbar-title>
        <NuxtLink to="/" class="text-white text-decoration-none">Cloudless</NuxtLink>
      </v-toolbar-title>
      <v-spacer />
      <LargeNav v-if="isDesktop" />
      <SmallNav v-else />
      <slot name="header" />
    </v-app-bar>
    <v-main>
      <v-container class="py-8 content-container">
        <slot />
      </v-container>
    </v-main>
    <v-footer app class="footer-transparent">
      <Footer />
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
  import VantaClouds2Background from '@/components/Base/VantaClouds2Background.vue';
  import Footer from '@/components/Layout/Footer.vue';
  import LargeNav from '@/components/Layout/Navigation/LargeNav.vue';
  import SmallNav from '@/components/Layout/Navigation/SmallNav.vue';
  import { useBreakpoints } from '@vueuse/core';

  const breakpoints = useBreakpoints({ md: 768 });
  const isDesktop = breakpoints.greaterOrEqual('md');
</script>

<style scoped>
  .transparent-overlay {
    background-color: rgba(0, 0, 0, 0.2) !important;
    backdrop-filter: blur(5px);
  }

  .footer-transparent {
    background: transparent !important;
    color: white !important;
    border: none !important;
    backdrop-filter: none !important;
  }

  .content-container {
    position: relative;
    z-index: 1;
    background-color: transparent !important;
    border-radius: 8px;
    padding: 20px;
  }

  :deep(.v-container) {
    background: transparent !important;
  }

  /* Ensure content is above the Vanta background */
  .v-main {
    position: relative;
    z-index: 1;
  }

  :deep(.v-card) {
    background-color: rgba(255, 255, 255, 0.7) !important;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  :deep(.v-card.primary-gradient) {
    background: linear-gradient(
      145deg,
      rgba(239, 246, 255, 0.8),
      rgba(224, 242, 254, 0.8)
    ) !important;
  }

  :deep(.v-btn) {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }

  :deep(.v-list.bg-transparent) {
    background-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
</style>
