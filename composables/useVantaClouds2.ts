// No imports needed

const loadedScripts = new Set<string>();

export function useVantaClouds2(element: HTMLElement | null) {
  let vantaEffect: any = null;

  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      console.log('[VantaClouds2] Attempting to load script:', src);
      if (document.querySelector(`script[src="${src}"]`)) {
        console.log('[VantaClouds2] Script already present:', src);
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        console.log('[VantaClouds2] Script loaded:', src);
        resolve();
      };
      script.onerror = () => {
        console.error('[VantaClouds2] Failed to load script:', src);
        reject(new Error(`Failed to load: ${src}`));
      };
      document.body.appendChild(script);
    });

  const initVanta = async () => {
    if (!element) {
      console.warn('[VantaClouds2] No element provided for Vanta effect.');
      return;
    }
    try {
      await loadScript('/three.r134.min.js');
      await loadScript('/vanta.clouds2.min.js');
      // @ts-ignore
      if (window.VANTA?.CLOUDS2) {
        console.log('[VantaClouds2] Initializing VANTA.CLOUDS2...');
        // @ts-ignore
        vantaEffect = window.VANTA.CLOUDS2({
          el: element,
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
        console.log('[VantaClouds2] VANTA.CLOUDS2 initialized:', vantaEffect);
      } else {
        console.error('[VantaClouds2] VANTA.CLOUDS2 is not available on window.VANTA');
      }
    } catch (error) {
      console.error('❌ Failed to load Vanta CLOUDS2:', error);
    }
  };

  if (typeof window !== 'undefined') {
    setTimeout(initVanta, 0);
    window.addEventListener('beforeunload', () => {
      if (vantaEffect) {
        vantaEffect.destroy();
        vantaEffect = null;
      }
    });
  }
}
