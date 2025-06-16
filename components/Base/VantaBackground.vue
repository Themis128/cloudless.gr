<template>
  <div id="vanta-bg" class="vanta-bg" ref="vantaRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useVantaClouds2 } from '@/composables/useVantaClouds2'

const vantaRef = ref<HTMLElement | null>(null)
let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = useVantaClouds2(vantaRef.value)
})

onBeforeUnmount(() => {
  if (cleanup) {
    cleanup()
  }
})
</script>

<style scoped>
.vanta-bg {
  position: fixed;
  top: -300px;   /* Move much higher to fully cover black */
  left: -100px;  /* Extend beyond viewport */
  right: -100px; /* Extend beyond viewport */
  bottom: -100px;/* Extend beyond viewport */
  z-index: 0;
  width: calc(100vw + 200px);  /* Extra width to prevent gaps */
  height: calc(100vh + 400px); /* Extra height with maximum top coverage */
  pointer-events: none;
  background: linear-gradient(135deg, #16213e 0%, #1a365d 25%, #2d3748 50%, #1a202c 75%, #16213e 100%);
  overflow: hidden;
  transform: scale(1.3) translateY(-60px); /* Larger scale and move up significantly */
}
</style>
