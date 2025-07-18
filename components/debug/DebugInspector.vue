<template>
  <div class="debug-inspector">
    <pre v-if="data">{{ formatted }}</pre>
    <div v-else>
      No data available.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps({
  data: {
    type: Object,
    default: null
  }
})
const formatted = computed(() => props.data ? JSON.stringify(props.data, null, 2) : '')
</script>

<style scoped>
.debug-inspector { font-family: monospace; }
</style>
