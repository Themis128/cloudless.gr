// Vanta.js Plugin for Nuxt 3
export default defineNuxtPlugin(async () => {
  if (process.client) {
    try {
      console.log('🌟 Vanta Plugin: Initializing...');

      // Load Three.js first
      const THREE = await import('three');
      console.log('🌟 Vanta Plugin: Three.js loaded');

      // Make THREE globally available
      (window as any).THREE = THREE;

      // Load Vanta Clouds2 effect
      await import('vanta/dist/vanta.clouds2.min.js');
      console.log('🌟 Vanta Plugin: Clouds2 effect loaded');

      // Verify VANTA is available
      if ((window as any).VANTA && (window as any).VANTA.CLOUDS2) {
        console.log('🌟 Vanta Plugin: Ready! CLOUDS2 effect available');
      } else {
        console.error('🌟 Vanta Plugin: Failed to load CLOUDS2 effect');
      }
    } catch (error) {
      console.error('🌟 Vanta Plugin: Error loading:', error);
    }
  }
});
