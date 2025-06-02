<template>
  <div ref="vantaContainer" class="vanta-clouds-background" :class="{ 'vanta-loaded': isLoaded }" />
</template>

<script setup lang="ts">
  import { nextTick, onMounted, onUnmounted, ref } from '#imports';
import { useDisplay } from 'vuetify';

  interface VantaEffect {
    destroy: () => void;
  }

  const vantaContainer = ref<HTMLElement>();
  const isLoaded = ref(false);
  let vantaEffect: VantaEffect | null = null;

  const { smAndDown } = useDisplay();

  const props = defineProps({
    skyColor: {
      type: Number,
      default: 0x68b8d7,
    },
    cloudColor: {
      type: Number,
      default: 0xadc1de,
    },
    cloudShadowColor: {
      type: Number,
      default: 0x183550,
    },
    sunColor: {
      type: Number,
      default: 0xff9919,
    },
    sunGlareColor: {
      type: Number,
      default: 0xff6633,
    },
    sunlightColor: {
      type: Number,
      default: 0xff9933,
    },
    speed: {
      type: Number,
      default: 1.0,
    },
  });

  const initVanta = async () => {
    if (!process.client || !vantaContainer.value || smAndDown.value) {
      console.log('🌟 Vanta: Not on client, container not ready, or mobile detected');
      return;
    }

    console.log('🌟 Vanta: Initializing Clouds2...');

    // Wait for VANTA to be available
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const VANTA = (window as any).VANTA;
      const THREE = (window as any).THREE;

      if (VANTA && VANTA.CLOUDS2 && THREE) {
        try {
          console.log('🌟 Vanta: Creating Clouds2 effect...');

          vantaEffect = VANTA.CLOUDS2({
            el: vantaContainer.value,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            skyColor: props.skyColor,
            cloudColor: props.cloudColor,
            cloudShadowColor: props.cloudShadowColor,
            sunColor: props.sunColor,
            sunGlareColor: props.sunGlareColor,
            sunlightColor: props.sunlightColor,
            speed: props.speed,
          });

          console.log('🌟 Vanta: Clouds2 effect created successfully!');
          isLoaded.value = true;
          return;
        } catch (error) {
          console.error('🌟 Vanta: Error creating effect:', error);
          break;
        }
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.error('🌟 Vanta: Failed to initialize after', maxAttempts, 'attempts');
  };

  onMounted(() => {
    console.log('🌟 Vanta Component: Mounted');
    nextTick(() => {
      setTimeout(initVanta, 500); // Give plugin time to load
    });
  });

  onUnmounted(() => {
    if (vantaEffect) {
      console.log('🌟 Vanta: Destroying effect');
      try {
        vantaEffect.destroy();
      } catch (error) {
        console.error('🌟 Vanta: Error destroying effect:', error);
      }
      vantaEffect = null;
    }
    isLoaded.value = false;
  });
</script>

<style scoped>
  .vanta-clouds-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -10;
    background: linear-gradient(135deg, #68b8d7 0%, #adc1de 50%, #183550 100%);
    transition: opacity 0.5s ease-in-out;
  }

  .vanta-clouds-background.vanta-loaded {
    background: transparent;
  }
</style>
