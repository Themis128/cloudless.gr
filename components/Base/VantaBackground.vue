<template>
  <div class="vanta-bg"></div>
</template>

<script setup lang="ts">
// Animation removed for troubleshooting
console.debug('[VantaBackground] Static background loaded (no animation)')
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
