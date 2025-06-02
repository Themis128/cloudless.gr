// Composable for loading and managing VANTA effects
// Remove: import { onBeforeUnmount, ref } from 'vue';
// Use Nuxt 3 auto-imports for 'onBeforeUnmount' and 'ref'.

export const useVanta = () => {
  const vantaEffect = ref<any>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const loadVantaEffect = async (
    elementRef: Ref<HTMLElement | null>,
    effectType: 'CLOUDS' | 'CLOUDS2',
    options: any = {}
  ) => {
    if (isLoading.value || !elementRef.value || !process.client) return;

    isLoading.value = true;
    error.value = null;

    try {
      // Load THREE.js first
      const ThreeModule = await import('three');

      // Load the appropriate VANTA effect
      if (effectType === 'CLOUDS') {
        await import('vanta/dist/vanta.clouds.min.js');
      } else if (effectType === 'CLOUDS2') {
        await import('vanta/dist/vanta.clouds2.min.js');
      }

      // Wait a bit for VANTA to attach to window
      await new Promise((resolve) => setTimeout(resolve, 100));

      const VANTA = (window as any).VANTA;

      if (!VANTA || !VANTA[effectType]) {
        throw new Error(`VANTA.${effectType} is not available`);
      }

      // Create the effect
      vantaEffect.value = VANTA[effectType]({
        el: elementRef.value,
        THREE: ThreeModule,
        ...options,
      });
    } catch (err) {
      error.value = `Failed to load VANTA ${effectType}: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  };

  const destroyEffect = () => {
    if (vantaEffect.value) {
      try {
        vantaEffect.value.destroy();
        vantaEffect.value = null;
      } catch (err) {
        console.error('Error destroying VANTA effect:', err);
      }
    }
  };

  // Cleanup on unmount
  onBeforeUnmount(() => {
    destroyEffect();
  });

  return {
    vantaEffect: readonly(vantaEffect),
    isLoading: readonly(isLoading),
    error: readonly(error),
    loadVantaEffect,
    destroyEffect,
  };
};
