<template>
  <NuxtLayout>
    <client-only>
      <LargeNav v-if="isDesktop" />
      <SmallNav v-else />
    </client-only>
    <NuxtPage />
    <Footer />
  </NuxtLayout>
</template>

<script setup>
import Footer from '@/components/Layout/Footer.vue';
import LargeNav from '@/components/Layout/Navigation/LargeNav.vue';
import SmallNav from '@/components/Layout/Navigation/SmallNav.vue';
import { useBreakpoints } from '@vueuse/core';

const breakpoints = useBreakpoints({ md: 768 });
const isDesktop = breakpoints.greaterOrEqual('md');
</script>

<style>
/* Add any global styles here if needed */
</style>
