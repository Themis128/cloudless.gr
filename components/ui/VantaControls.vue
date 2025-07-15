<template>
  <div class="vanta-controls">
    <v-switch v-model="enabled" label="Animated Sky" />
    <v-slider v-model="speed" :min="0.1" :max="2" :step="0.05" label="Cloud Speed" />
    <v-slider v-model="cloudHeight" :min="0.1" :max="2" :step="0.05" label="Cloud Height" />
    <v-slider v-model="lightDirection" :min="0.1" :max="2" :step="0.05" label="Light Direction" />
    <v-color-picker v-model="skyColor" label="Sky Color" hide-inputs />
    <v-color-picker v-model="cloudColor" label="Cloud Color" hide-inputs />
    <v-switch v-model="reducedMotion" label="Reduced Motion" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue'

const props = defineProps({
  initial: Object
})
const emit = defineEmits(['update'])

const enabled = ref(true)
const speed = ref(props.initial?.speed ?? 1.2)
const cloudHeight = ref(props.initial?.cloudHeight ?? 0.8)
const lightDirection = ref(props.initial?.lightDirection ?? 1.2)
const skyColor = ref(props.initial?.skyColor ?? '#6a7ba2')
const cloudColor = ref(props.initial?.cloudColor ?? '#e0e6ef')
const reducedMotion = ref(false)

watch([enabled, speed, cloudHeight, lightDirection, skyColor, cloudColor, reducedMotion], () => {
  emit('update', {
    enabled: enabled.value,
    speed: reducedMotion.value ? 0.2 : speed.value,
    cloudHeight: cloudHeight.value,
    lightDirection: lightDirection.value,
    skyColor: skyColor.value,
    cloudColor: cloudColor.value,
    reducedMotion: reducedMotion.value
  })
})
</script>

<style scoped>
.vanta-controls {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(255,255,255,0.9);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  padding: 1rem;
  z-index: 10;
  min-width: 220px;
}
</style>
