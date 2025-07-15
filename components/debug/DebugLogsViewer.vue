<template>
  <div class="debug-logs-viewer">
    <div v-if="logs && logs.length">
      <div v-for="(line, idx) in logs" :key="idx" class="log-line">{{ line }}</div>
    </div>
    <div v-else>No logs available.</div>
  </div>
</template>
<script setup lang="ts">
const props = defineProps({
  logs: {
    type: Array,
    default: () => []
  }
})
</script>
<style scoped>
.debug-logs-viewer { font-family: monospace; }
.log-line { white-space: pre-wrap; }
</style>
