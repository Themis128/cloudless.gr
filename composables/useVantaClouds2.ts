// No imports needed

const _loadedScripts = new Set<string>();

export function useVantaClouds2(element: HTMLElement | null) {
  interface VantaClouds2Options {
    mouseControls: boolean;
    touchControls: boolean;
    gyroControls: boolean;
    minHeight: number;
    minWidth: number;
    scale: number;
    scaleMobile: number;
    texturePath: string;
    backgroundColor: number;
    skyColor: number;
    cloudColor: number;
    shadowColor: number;
    lightColor: number;
    speed: number;
    size: number;
    density: number;
    cloudShadow: boolean;
    shadowIntensity: number;
    shadowBlur: number;
    skyOpacity: number;
    cloudOpacity: number;
    yOffset: number;
    xOffset: number;
    contrast: number;
    brightness: number;
    [key: string]: unknown; // For any additional dynamic options
  }

  let vantaEffect: { destroy: () => void; resize: () => void; options: VantaClouds2Options } | null = null;
  // Get responsive parameters based on screen size
  const getResponsiveConfig = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Mobile configuration
    if (width <= 768) {
      return {
        minHeight: height + 100, // Extend beyond viewport
        minWidth: width + 100,   // Extend beyond viewport
        scale: 1.2,              // Increased scale for better coverage
        speed: 0.7,
        mouseControls: false,
        touchControls: true
      };
    }
    // Tablet configuration
    else if (width <= 1024) {
      return {
        minHeight: height + 200, // Extend beyond viewport
        minWidth: width + 200,   // Extend beyond viewport
        scale: 1.3,              // Increased scale for better coverage
        speed: 0.8,
        mouseControls: true,
        touchControls: true
      };
    }
    // Desktop configuration
    else {
      return {
        minHeight: height + 300, // Extend beyond viewport
        minWidth: width + 300,   // Extend beyond viewport
        scale: 1.5,              // Increased scale for full coverage
        speed: 1.0,
        mouseControls: true,
        touchControls: true
      };
    }
  };

  // Handle window resize
  const handleResize = () => {
    if (vantaEffect) {
      const config = getResponsiveConfig();
      vantaEffect.resize();
      // Update configuration on resize
      Object.assign(vantaEffect.options, config);
    }
  };

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
    }    // Ensure element covers the full viewport including top
    element.style.position = 'fixed';
    element.style.top = '-300px';
    element.style.left = '-100px';
    element.style.width = 'calc(100vw + 200px)';
    element.style.height = 'calc(100vh + 400px)';
    element.style.zIndex = '0';
    
    try {
      await loadScript('/three.r134.min.js');
      await loadScript('/vanta.clouds2.min.js');      // @ts-ignore - VANTA is a global library loaded via script tag
      if (window.VANTA?.CLOUDS2) {
        console.log('[VantaClouds2] Initializing VANTA.CLOUDS2...');
        const config = getResponsiveConfig();        
        // @ts-ignore - VANTA.CLOUDS2 is dynamically loaded and not typed
        vantaEffect = window.VANTA.CLOUDS2({
          el: element,
          mouseControls: config.mouseControls,
          touchControls: config.touchControls,
          gyroControls: false,
          minHeight: config.minHeight,
          minWidth: config.minWidth,
          scale: config.scale,
          scaleMobile: 1.2, // Ensure mobile has good coverage
          texturePath: '/gallery/noise.png',          backgroundColor: 0x87ceeb, // Light sky blue background
          skyColor: 0x4a90e2,        // Bright blue sky
          cloudColor: 0xf0f8ff,      // Light white/blue clouds
          shadowColor: 0x0d1117,     // Much darker shadows between clouds (almost black)
          lightColor: 0xffffff,      // Bright white light
          speed: config.speed,          size: 1.2,                 // Smaller/thinner clouds
          density: 0.6,              // Lower density for thinner cloud coverage
          cloudShadow: true,         // Enable cloud shadows          shadowIntensity: 1.2,      // Maximum shadow intensity for very dark shadows
          shadowBlur: 2,             // Sharp shadow edges for maximum definition
          skyOpacity: 0.85,          // Slightly lower to let shadows show through more
          cloudOpacity: 0.7,         // Lower opacity for thinner, more transparent clouds
          yOffset: 0.2,              // Move clouds down to middle (positive value moves down)
          xOffset: 0,                // Keep horizontal position centered          contrast: 1.6,             // Even higher contrast for more defined shadows
          brightness: 0.9,           // Slightly lower brightness to enhance shadow visibility
        });
        console.log('[VantaClouds2] VANTA.CLOUDS2 initialized:', vantaEffect);
        
        // Add resize event listener for responsive behavior
        window.addEventListener('resize', handleResize);
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
      // Remove resize event listener
      window.removeEventListener('resize', handleResize);
    });
  }

  // Return cleanup function for component unmount
  return () => {
    if (vantaEffect) {
      vantaEffect.destroy();
      vantaEffect = null;
    }
    window.removeEventListener('resize', handleResize);
  };
}
