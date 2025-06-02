<template>
  <div
    v-if="showDebug"
    style="
      position: fixed;
      top: 50px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
      max-height: 200px;
      overflow-y: auto;
    "
  >
    <div style="margin-bottom: 5px; font-weight: bold">🌟 Vanta Debug Console</div>
    <div>
      Plugin Status:
      <span :style="{ color: pluginLoaded ? '#00ff00' : '#ff0000' }">{{
        pluginLoaded ? 'Loaded' : 'Loading...'
      }}</span>
    </div>
    <div>
      THREE.js:
      <span :style="{ color: threeLoaded ? '#00ff00' : '#ff0000' }">{{
        threeLoaded ? 'Available' : 'Missing'
      }}</span>
    </div>
    <div>
      VANTA.CLOUDS2:
      <span :style="{ color: vantaLoaded ? '#00ff00' : '#ff0000' }">{{
        vantaLoaded ? 'Available' : 'Missing'
      }}</span>
    </div>
    <div>
      Component:
      <span :style="{ color: componentActive ? '#00ff00' : '#ffaa00' }">{{
        componentActive ? 'Active' : 'Initializing'
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  // Use # imports that work in Nuxt 3
  const showDebug = ref(true);
  const pluginLoaded = ref(false);
  const threeLoaded = ref(false);
  const vantaLoaded = ref(false);
  const componentActive = ref(false);

  const checkStatus = () => {
    if (process.client) {
      threeLoaded.value = !!(window as any).THREE;
      vantaLoaded.value = !!(window as any).VANTA && !!(window as any).VANTA.CLOUDS2;
      pluginLoaded.value = threeLoaded.value && vantaLoaded.value;
    }
  };

  // Check status every 500ms
  let statusInterval: ReturnType<typeof setInterval>;

  onMounted(() => {
    statusInterval = setInterval(checkStatus, 500);
    checkStatus();
  });

  onUnmounted(() => {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
  });

  // Listen for component events (if needed)
  // You could emit events from VantaCloudBackground to update componentActive
</script>
