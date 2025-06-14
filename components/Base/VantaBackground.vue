<template>
  <div id="vanta-bg" class="vanta-bg" ref="vantaRef"></div>
</template>

<script setup lang="ts">
import { useVantaClouds2 } from '@/composables/useVantaClouds2'

const { vantaRef } = useVantaClouds2()
</script>

<style scoped>
.vanta-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: #222c36;
}
</style>
