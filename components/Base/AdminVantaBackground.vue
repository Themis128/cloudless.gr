<template>
  <div ref="vantaRef" class="vanta-bg" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

let vantaEffect: any = null;
const vantaRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  const VANTA = (await import('vanta/dist/vanta.clouds2.min')).default;
  const THREE = await import('three');

  const isMobile = window.innerWidth < 768;
  if (vantaRef.value) {
    vantaEffect = VANTA({
      el: vantaRef.value,
      THREE,
      mouseControls: true,
      touchControls: true,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      zoom: isMobile ? 0.55 : 1.0,
      backgroundColor: 0x2c3e50, // Darker blue for admin
      color: 0xffffff,
      cloudColor: 0x7f8c8d, // Grey clouds for admin
      cloudShadowColor: 0x000000, // Black shadow color for clouds
      speed: 0.5, // Slightly faster for admin
      cloudShadow: true, // Enable cloud shadows
      cloudShadowOpacity: 0.9,
      cloudOpacity: 0.85,
      cloudCover: 0.25, // More clouds in admin area
      cloudSpacing: 2.5,
      // Explicitly set the texture path to prevent router navigation
      noiseTexture: '/gallery/noise.png',
      shade: {
        text: 'Admin Dashboard\nCloudless.gr\nManage your site with confidence.',
        fontStyle: 'calligraphic',
        textShadow: '2px 2px 4px #000000',
        animation: {
          type: 'fadeInOut',
          duration: 3000,
          intensity: 'medium',
        },
      },
    });
  }
});

onBeforeUnmount(() => {
  if (vantaEffect) vantaEffect.destroy();
});
</script>

<style scoped>
.vanta-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
}
</style>
