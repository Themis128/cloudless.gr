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
      backgroundColor: 0x7ec0ee,
      color: 0xffffff,
      cloudColor: 0x333333, // Even darker clouds
      cloudShadowColor: 0x000000, // Black shadow color for clouds
      speed: 0.3,
      cloudShadow: true, // Enable cloud shadows
      cloudShadowOpacity: 0.9, // Increase shadow opacity for a more pronounced effect      cloudOpacity: 0.85, // Reduced opacity for darker clouds
      cloudCover: 0.15, // Increased cloud cover for more density
      cloudSpacing: 2.8,
      // Explicitly set the texture path to prevent router navigation
      // In Nuxt, files in the public directory are served at the root path
      noiseTexture: '/gallery/noise.png',
      shade: {
        text: 'Welcome to\nCloudless.gr\nElevating your cloud solutions with innovation, clarity, and precision.',
        fontStyle: 'calligraphic', // Ensures calligraphic style
        textShadow: '2px 2px 4px #000000', // Adds a dark shade to the text
        animation: {
          type: 'fadeInOut', // Adds a sense of motion with fade-in and fade-out effect
          duration: 3000, // Duration of the animation in milliseconds
          intensity: 'high', // Enhances the animation for a more pronounced effect
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
