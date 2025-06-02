<template>
  <ClientOnly>
    <div ref="vantaRef" class="vanta-bg"></div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from '#imports'
import type { VantaClouds2Effect } from '~/types/vanta'

const vantaRef = ref<HTMLElement | null>(null)
let vantaEffect: VantaClouds2Effect | null = null

onMounted(async () => {
  // Ensure we're on the client side
  if (typeof window === 'undefined') return

  // Wait for next tick to ensure DOM is ready
  await nextTick()

  try {
    // Dynamic imports
    const THREE = await import('three')
    // Load VANTA using require to avoid TypeScript declaration issues
    if (!window.VANTA) {
      require('vanta/dist/vanta.clouds2.min')
    }

    if (vantaRef.value && window.VANTA) {
      const options = {
        el: vantaRef.value,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        backgroundColor: 0x0,
        skyColor: 0x5ca6ca,
        cloudColor: 0x334d80,
        lightColor: 0xffffff,
        speed: 1,
        texturePath: '/gallery/noise.png',
        cloudShadowColor: 0x000000,
        sunGlareColor: 0x6699ff,
        sunlightColor: 0xffffff
      }

      vantaEffect = window.VANTA.CLOUDS2(options)
    }
  } catch (error) {
    console.error('Failed to initialize VANTA effect:', error)
  }
})

onUnmounted(() => {
  if (vantaEffect) {
    vantaEffect.destroy()
  }
})
</script>

<style scoped>
.vanta-bg {
  position: fixed !important;
  z-index: 0 !important;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

/* Remove any existing overlay that might interfere with visibility */
.vanta-bg::after {
  display: none;
}

/* Ensure the background is visible through all layers */
:deep(.v-application) {
  background: transparent !important;
}

:deep(.v-main) {
  background: transparent !important;
}
</style>
