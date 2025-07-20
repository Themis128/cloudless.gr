// VANTA.Clouds2 background integration for Nuxt/Vite
// Dynamically import three and vanta, and ensure window.THREE is set before Vanta loads

export default async function mountVantaClouds2(el, options = {}) {
  let vantaEffect = null

  if (typeof window !== 'undefined') {
    try {
      // Load Three.js if not already loaded
      if (!window.THREE) {
        const script1 = document.createElement('script')
        script1.src = '/vanta/three.min.js'
        script1.async = true
        document.head.appendChild(script1)

        await new Promise((resolve, reject) => {
          script1.onload = resolve
          script1.onerror = reject
        })
      }

      // Load Vanta Clouds2 if not already loaded
      if (!window.VANTA || !window.VANTA.CLOUDS2) {
        const script2 = document.createElement('script')
        script2.src = '/vanta/vanta.clouds2.min.js'
        script2.async = true
        document.head.appendChild(script2)

        await new Promise((resolve, reject) => {
          script2.onload = resolve
          script2.onerror = reject
        })
      }

      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100))

      if (window.VANTA && window.VANTA.CLOUDS2) {
        vantaEffect = window.VANTA.CLOUDS2({
          el,
          THREE: window.THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          skyColor: options.skyColor || 0x4a5b8a,
          cloudColor: options.cloudColor || 0xd0d8f0,
          lightColor: options.lightColor || 0xffffff,
          speed: options.speed || 2.5,
          cloudHeight: options.cloudHeight || 1.2,
          cloudDensity: options.cloudDensity || 2.5,
          cloudScale: options.cloudScale || 1.5,
          lightDirection: options.lightDirection || 1.8,
          lightIntensity: options.lightIntensity || 1.8,
          texturePath: '/vanta/gallery/noise.png',
          ...options,
        })
      }
    } catch (error) {
      // Error loading Vanta Clouds2 - silent fail for production
      if (process.env.NODE_ENV === 'development') {
        // console.error('Error loading Vanta Clouds2:', error)
      }
    }
  }

  return () => {
    if (vantaEffect) {
      try {
        vantaEffect.destroy()
      } catch (error) {
        // Error destroying Vanta effect - silent fail for production
        if (process.env.NODE_ENV === 'development') {
          // console.warn('Error destroying Vanta effect:', error)
        }
      }
    }
  }
}
