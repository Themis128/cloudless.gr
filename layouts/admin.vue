<template>
  <VApp :theme="currentTheme">
    <!-- Layered background with theme toggle -->
    <div :class="['admin-bg-layer', isLightBg ? 'admin-bg-layer-light' : '']">
      <div class="pattern pattern-dots" />
      <div class="pattern pattern-lines" />
      <div class="shade shade-1" />
      <div class="shade shade-2" />
      <div class="shade shade-3" />
    </div>

    <div class="admin-layout">
      <div class="theme-toggle-btn">
        <v-btn icon elevation="2" :title="isLightBg ? 'Switch to Dark Background' : 'Switch to Light Background'"
          @click="toggleBg">
          <v-icon>{{ isLightBg ? 'mdi-white-balance-sunny' : 'mdi-weather-night' }}</v-icon>
        </v-btn>
      </div>
      <VMain class="main-content">
        <slot />
      </VMain>
      <Suspense>
        <template #default>
          <Footer :year="currentYear" />
        </template>
        <template #fallback>
          <div class="text-sm text-gray-400 text-center py-2">Loading footer...</div>
        </template>
      </Suspense>
      <Suspense>
        <template #default>
          <AccessibilityMenu />
        </template>
      </Suspense>
    </div>
  </VApp>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTheme } from 'vuetify'
import { defineAsyncComponent } from 'vue'
const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))
const AccessibilityMenu = defineAsyncComponent(() => import('@/components/accessibility/AccessibilityMenu.vue'))
const currentYear = new Date().getFullYear()
const theme = useTheme()
const currentTheme = theme.global.name
const isLightBg = ref(false)
function toggleBg() {
  isLightBg.value = !isLightBg.value
}
</script>

<style scoped>
/* Background layer */

.admin-bg-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.08), transparent 50%),
    radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.08), transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.03), transparent 70%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.03) 0px, transparent 8px, transparent 16px),
    #181824;
}

.admin-bg-layer-light {
  background:
    radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.13), transparent 50%),
    radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.13), transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.13), transparent 70%),
    repeating-linear-gradient(45deg, rgba(168, 85, 247, 0.06) 0px, transparent 8px, transparent 16px),
    #f3f6fa;
}

.theme-toggle-btn {
  position: absolute;
  top: 2rem;
  right: 2rem;
  z-index: 10;
}

/* Pattern overlays: always below shades for best contrast */
.pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.pattern-dots {
  background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1.5px, transparent 1.5px);
  background-size: 32px 32px;
  opacity: 0.32;
}

.pattern-lines {
  background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0 2px, transparent 2px 16px);
  background-size: 32px 32px;
  opacity: 0.22;
}

/* Subtle shade overlays for depth, above patterns */
.shade {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.22;
  pointer-events: none;
  z-index: 2;
}

.shade-1 {
  width: 400px;
  height: 400px;
  top: 10%;
  left: 5%;
  background: #3b82f6;
}

.shade-2 {
  width: 300px;
  height: 300px;
  bottom: 15%;
  right: 10%;
  background: #a855f7;
}

.shade-3 {
  width: 250px;
  height: 250px;
  top: 60%;
  left: 60%;
  background: #f59e42;
}

/* Layout wrapper */
.admin-layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  z-index: 3;
}

.v-main {
  background-color: transparent !important;
  color: #f3f3f3;
}

.main-content {
  flex: 1;
  padding: 2rem;
  position: relative;
  z-index: 4;
}

.footer {
  padding: 1rem;
  font-size: 0.875rem;
  border-top: 1px solid #444;
  background-color: #1a1a2b;
  position: relative;
  z-index: 4;
}
</style>
