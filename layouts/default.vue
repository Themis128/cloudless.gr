<template>
  <v-app>
    <div ref="vantaRef" id="vanta-bg" class="vanta-bg"></div>
    <div class="app-layout">
      <header class="app-header">
        <div class="logo-row">
          <SvgIcon name="logo" size="40" class="logo" />
          <span class="wizard-hat-emoji">🧙‍♂️</span>
          <h1 class="logo-text">Cloudless Wizard</h1>
        </div>
      </header>
      <div class="wizard-body">
        <main class="app-main">
          <slot />
        </main>
      </div>
      <footer class="app-footer">
        <span>&copy; 2025 Cloudless</span>
      </footer>
    </div>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const vantaRef = ref(null)
let vantaEffect = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js')
    await loadScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds2.min.js')
    if (window.VANTA && window.VANTA.CLOUDS2 && vantaRef.value) {
      vantaEffect = window.VANTA.CLOUDS2({
        el: '#vanta-bg',
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
        speed: 1.2,
        cloudShadow: 1.0,
        cloudHeight: 0.8,
        cloudBaseColor: 0xd2d9e6,
        lightDirection: 1.2,
        gyroControls: true,
      })
    }
  }
})

onBeforeUnmount(() => {
  if (vantaEffect) vantaEffect.destroy()
})
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

.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 3;
}

.wizard-body {
  display: flex;
  flex: 1 1 auto;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #eee;
  padding: 0.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 1px;
}

.wizard-hat-emoji {
  font-size: 2rem;
}

.app-main {
  flex: 1 1 auto;
  padding: 2rem;
  background: transparent;
  min-height: 80vh;
}

.app-footer {
  background: #fff;
  border-top: 1px solid #eee;
  padding: 1rem 2rem;
  text-align: center;
  color: #888;
  font-size: 0.9rem;
}
</style>
