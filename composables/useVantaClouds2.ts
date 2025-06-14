import { onMounted, onBeforeUnmount, ref } from 'vue';

const loadedScripts = new Set<string>();

export function useVantaClouds2() {
  const vantaRef = ref<HTMLElement | null>(null);
  let vantaEffect: any = null;

  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      if (loadedScripts.has(src)) return resolve();
      if (document.querySelector(`script[src="${src}"]`)) {
        loadedScripts.add(src);
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        loadedScripts.add(src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.body.appendChild(script);
    });

  onMounted(async () => {
    if (!process.client || !vantaRef.value) return;
    try {
      await loadScript('/three.r134.min.js');
      await loadScript('/vanta.clouds2.min.js');

      // @ts-ignore
      if (window.VANTA?.CLOUDS2) {
        // @ts-ignore
        vantaEffect = window.VANTA.CLOUDS2({
          el: vantaRef.value,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1.0,
          texturePath: '/gallery/noise.png',
          backgroundColor: 0x0,
          skyColor: 0x5ca6ca,
          cloudColor: 0x334d80,
          lightColor: 0xffffff,
          speed: 1,
        });
      }
    } catch (error) {
      console.error('❌ Failed to load Vanta CLOUDS2:', error);
    }
  });

  onBeforeUnmount(() => {
    if (vantaEffect) {
      vantaEffect.destroy();
      vantaEffect = null;
    }
  });

  return { vantaRef };
}
