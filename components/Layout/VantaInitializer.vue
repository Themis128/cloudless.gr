<template>
  <VantaClouds2Background v-if="isEnabled" />
</template>

<script setup lang="ts">
import VantaClouds2Background from '@/components/VantaClouds2Background.vue';
import { useVantaBackground } from '@/composables/useVantaBackground';

const { isEnabled } = useVantaBackground();
</script>
