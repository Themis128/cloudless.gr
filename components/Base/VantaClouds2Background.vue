<template>
  <div ref="vantaRef" class="vanta-clouds2-bg" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
let vantaEffect: any = null;
const vantaRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  const VANTA = (await import('vanta/dist/vanta.clouds2.min')).default;
  const THREE = await import('three');
  vantaEffect = VANTA({
    el: vantaRef.value,
    THREE,
    mouseControls: true,
    touchControls: true,
    minHeight: 200.0,
    minWidth: 200.0,
    scale: 1.5,
    scaleMobile: 1.2,
    backgroundColor: 0xffffff,
    color1: 0x60a5fa, // Brighter blue for better visibility
    color2: 0xdbeafe, // Much lighter blue for contrast
    speed: 0.4, // Slower for better visibility
    size: 2.5, // Even larger cloud particles
    spacing: 12.0, // Closer spacing for more visible clouds
    noise: 3.0, // More pronounced cloud shapes
    transparency: 0.85, // More opaque clouds
  });
});

onBeforeUnmount(() => {
  if (vantaEffect) vantaEffect.destroy();
});
</script>

<style scoped>
.vanta-clouds2-bg {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
}
</style>
