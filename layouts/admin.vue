<template>
  <VApp theme="dark">
    <!-- Dark background layer with subtle shades and patterns -->
    <div class="admin-bg-layer">
      <div class="pattern pattern-dots" />
      <div class="pattern pattern-lines" />
      <div class="shade shade-1" />
      <div class="shade shade-2" />
      <div class="shade shade-3" />
    </div>

    <div class="admin-layout">
      <VMain class="main-content">
        <slot />
      </VMain>

      <VFooter app class="footer text-center text-grey-lighten-1">
        © {{ currentYear }} Cloudless GR Admin
      </VFooter>
    </div>
  </VApp>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<style scoped>
/* Background layer */
.admin-bg-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: linear-gradient(135deg, #181824, #23233a);
  opacity: 1;
  overflow: hidden;
}

/* Pattern overlays: always below shades for best contrast */
.pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.pattern-dots {
  background-image: radial-gradient(rgba(255,255,255,0.12) 1.5px, transparent 1.5px);
  background-size: 32px 32px;
  opacity: 0.32;
}
.pattern-lines {
  background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.09) 0 2px, transparent 2px 16px);
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
