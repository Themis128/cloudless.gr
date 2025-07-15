// VANTA.Clouds2 background integration for Nuxt/Vite
// Dynamically import three and vanta, and ensure window.THREE is set before Vanta loads

export default async function mountVantaClouds2(el) {
  let vantaEffect = null
  if (typeof window !== 'undefined') {
    if (!window.THREE) {
      const THREE = await import('three')
      window.THREE = THREE
    }
    const { default: CLOUDS2 } = await import('vanta/dist/vanta.clouds2.min.js')
    vantaEffect = CLOUDS2({
      el,
      mouseControls: true,
      touchControls: true,
      minHeight: 200.00,
      minWidth: 200.00,
      skyColor: 0x6a7ba2,
      cloudColor: 0xe0e6ef,
      cloudShadowColor: 0x3b4960,
      sunColor: 0xf9f9fb,
      sunGlareColor: 0xf9f9fb,
      sunlightColor: 0xf9f9fb,
      speed: 1.2, // more movement
      cloudShadow: 1.0, // more depth
      cloudHeight: 0.8, // more vertical movement
      cloudBaseColor: 0xd2d9e6, // subtle color variation
      lightDirection: 1.2, // more dynamic lighting
      mouseControls: true,
      touchControls: true,
      gyroControls: true,
      // You can further tweak these for realism
    })
  }
  return () => {
    if (vantaEffect) vantaEffect.destroy()
  }
}
