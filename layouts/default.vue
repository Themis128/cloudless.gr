<template>
  <v-app>
    <div v-show="vantaEnabled" ref="vantaRef" id="vanta-bg" class="vanta-bg">
  <img src="/vanta/gallery/noise.png" class="vanta-noise" alt="noise" />
    </div>
    <button
      class="vanta-toggle-btn"
      @click="showVantaControls = !showVantaControls"
      aria-label="Toggle Vanta Controls"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01"/></svg>
    </button>
    <client-only>
      <VantaControls v-if="showVantaControls" :initial="vantaOptions" @update="onVantaUpdate" />
    </client-only>
    <div class="app-layout">
      <header class="app-header">
        <div class="logo-row">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo">
            <rect width="48" height="48" rx="12" fill="#23232b"></rect>
            <circle cx="24" cy="24" r="14" fill="#fff"></circle>
            <text x="50%" y="54%" text-anchor="middle" font-size="16" fill="#23232b" font-family="Arial, Helvetica, sans-serif">CL</text>
          </svg>
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
import { ref as vueRef } from 'vue'
const showVantaControls = vueRef(false)
import { ref, onMounted, onBeforeUnmount, watch, defineExpose } from 'vue'

import VantaControls from '~/components/ui/VantaControls.vue'


// Accessibility: detect prefers-reduced-motion
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const vantaRef = ref<HTMLElement | null>(null)
let vantaEffect: any = null
const vantaEnabled = ref(true)
const vantaOptions = ref({
  speed: 1.2,
  cloudHeight: 0.8,
  lightDirection: 1.2,
  skyColor: '#6a7ba2',
  cloudColor: '#e0e6ef',
  reducedMotion: prefersReducedMotion
})

declare global {
  interface Window {
    VANTA?: any
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function hexToColor(hex: string | number): number | string {
  if (typeof hex === 'number') return hex
  if (hex.startsWith('#')) return parseInt(hex.replace('#', '0x'))
  return hex
}

let resizeTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    if (vantaEffect && typeof vantaEffect.resize === 'function') vantaEffect.resize()
  }, 200)
}

function destroyVanta() {
  if (vantaEffect) {
    vantaEffect.destroy()
    vantaEffect = null
  }
}

async function initVanta() {
  destroyVanta()
  if (!vantaEnabled.value) return
  await loadScript('/vanta/three.min.js')
  await loadScript('/vanta/vanta.clouds2.min.js')
  if (window.VANTA && window.VANTA.CLOUDS2 && vantaRef.value) {
    vantaEffect = window.VANTA.CLOUDS2({
      el: '#vanta-bg',
      mouseControls: true,
      touchControls: true,
      minHeight: 200.00,
      minWidth: 200.00,
      skyColor: hexToColor(vantaOptions.value.skyColor),
      cloudColor: hexToColor(vantaOptions.value.cloudColor),
      cloudShadowColor: 0x3b4960,
      sunColor: 0xf9f9fb,
      sunGlareColor: 0xf9f9fb,
      sunlightColor: 0xf9f9fb,
      speed: vantaOptions.value.reducedMotion ? 0.2 : vantaOptions.value.speed,
      cloudShadow: 1.0,
      cloudHeight: vantaOptions.value.cloudHeight,
      cloudBaseColor: 0xd2d9e6,
      lightDirection: vantaOptions.value.lightDirection,
      gyroControls: true,
      texturePath: '/vanta/gallery/noise.png',
    })
  }
}

function onVantaUpdate(opts: any) {
  vantaEnabled.value = opts.enabled
  vantaOptions.value = opts
  if (opts.reducedMotion) {
    if (vantaEffect) vantaEffect.setOptions({ speed: 0.2 })
  }
  initVanta()
}

defineExpose({ vantaEnabled, vantaOptions, onVantaUpdate })

onMounted(() => {
  if (vantaOptions.value.reducedMotion) vantaEnabled.value = false
  initVanta()
  window.addEventListener('resize', debouncedResize)
})
onBeforeUnmount(() => {
  destroyVanta()
  window.removeEventListener('resize', debouncedResize)
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
  overflow: hidden;
}
.vanta-noise {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.12;
  object-fit: cover;
  pointer-events: none;
  z-index: 1;
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
.vanta-toggle-btn {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 20;
  background: #fff;
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.vanta-toggle-btn:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.16);
}
</style>
