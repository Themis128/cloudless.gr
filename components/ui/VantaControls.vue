<template>
  <div class="vanta-controls">
    <div class="controls-header">
      <h3>Sky Controls</h3>
      <v-btn icon size="small" @click="$emit('close')" class="close-btn">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>
    
    <div class="controls-section">
      <v-switch v-model="enabled" label="Animated Sky" color="primary" />
    </div>
    
    <div class="controls-section">
      <h4>Animation</h4>
      <v-slider 
        v-model="speed" 
        :min="0.1" 
        :max="3" 
        :step="0.05" 
        label="Cloud Speed" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="cloudDensity" 
        :min="0.1" 
        :max="2" 
        :step="0.05" 
        label="Cloud Density" 
        color="primary"
        thumb-label
      />
    </div>
    
    <div class="controls-section">
      <h4>Cloud Properties</h4>
      <v-slider 
        v-model="cloudHeight" 
        :min="0.1" 
        :max="2" 
        :step="0.05" 
        label="Cloud Height" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="cloudScale" 
        :min="0.5" 
        :max="3" 
        :step="0.1" 
        label="Cloud Scale" 
        color="primary"
        thumb-label
      />
    </div>
    
    <div class="controls-section">
      <h4>Lighting</h4>
      <v-slider 
        v-model="lightDirection" 
        :min="0.1" 
        :max="2" 
        :step="0.05" 
        label="Light Direction" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="lightIntensity" 
        :min="0.1" 
        :max="2" 
        :step="0.05" 
        label="Light Intensity" 
        color="primary"
        thumb-label
      />
    </div>
    
    <div class="controls-section">
      <h4>Colors</h4>
      <div class="color-picker-group">
        <label>Sky Color</label>
        <v-color-picker 
          v-model="skyColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div class="color-picker-group">
        <label>Cloud Color</label>
        <v-color-picker 
          v-model="cloudColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div class="color-picker-group">
        <label>Light Color</label>
        <v-color-picker 
          v-model="lightColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
    </div>
    
    <div class="controls-section">
      <h4>Camera</h4>
      <v-switch v-model="mouseControls" label="Mouse Controls" color="primary" />
      <v-switch v-model="touchControls" label="Touch Controls" color="primary" />
      <v-switch v-model="gyroControls" label="Gyro Controls" color="primary" />
    </div>
    
    <div class="controls-section">
      <h4>Performance</h4>
      <v-switch v-model="reducedMotion" label="Reduced Motion" color="primary" />
      <v-slider 
        v-model="quality" 
        :min="0.5" 
        :max="1" 
        :step="0.1" 
        label="Quality" 
        color="primary"
        thumb-label
      />
    </div>
    
    <div class="controls-section">
      <v-btn 
        @click="resetToDefaults" 
        variant="outlined" 
        color="primary"
        block
      >
        Reset to Defaults
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps({
  initial: Object
})
const emit = defineEmits(['update', 'close'])

const enabled = ref(true)
const speed = ref(props.initial?.speed ?? 1.2)
const cloudHeight = ref(props.initial?.cloudHeight ?? 0.8)
const cloudDensity = ref(props.initial?.cloudDensity ?? 1.0)
const cloudScale = ref(props.initial?.cloudScale ?? 1.0)
const lightDirection = ref(props.initial?.lightDirection ?? 1.2)
const lightIntensity = ref(props.initial?.lightIntensity ?? 1.0)
const skyColor = ref(props.initial?.skyColor ?? '#6a7ba2')
const cloudColor = ref(props.initial?.cloudColor ?? '#e0e6ef')
const lightColor = ref(props.initial?.lightColor ?? '#ffffff')
const mouseControls = ref(props.initial?.mouseControls ?? true)
const touchControls = ref(props.initial?.touchControls ?? true)
const gyroControls = ref(props.initial?.gyroControls ?? false)
const reducedMotion = ref(props.initial?.reducedMotion ?? false)
const quality = ref(props.initial?.quality ?? 1.0)

function resetToDefaults() {
  enabled.value = true
  speed.value = 1.2
  cloudHeight.value = 0.8
  cloudDensity.value = 1.0
  cloudScale.value = 1.0
  lightDirection.value = 1.2
  lightIntensity.value = 1.0
  skyColor.value = '#6a7ba2'
  cloudColor.value = '#e0e6ef'
  lightColor.value = '#ffffff'
  mouseControls.value = true
  touchControls.value = true
  gyroControls.value = false
  reducedMotion.value = false
  quality.value = 1.0
}

watch([
  enabled, speed, cloudHeight, cloudDensity, cloudScale, 
  lightDirection, lightIntensity, skyColor, cloudColor, lightColor,
  mouseControls, touchControls, gyroControls, reducedMotion, quality
], () => {
  emit('update', {
    enabled: enabled.value,
    speed: reducedMotion.value ? 0.2 : speed.value,
    cloudHeight: cloudHeight.value,
    cloudDensity: cloudDensity.value,
    cloudScale: cloudScale.value,
    lightDirection: lightDirection.value,
    lightIntensity: lightIntensity.value,
    skyColor: skyColor.value,
    cloudColor: cloudColor.value,
    lightColor: lightColor.value,
    mouseControls: mouseControls.value,
    touchControls: touchControls.value,
    gyroControls: gyroControls.value,
    reducedMotion: reducedMotion.value,
    quality: quality.value
  })
})
</script>

<style scoped>
.vanta-controls {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(255,255,255,0.95);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  padding: 1.5rem;
  z-index: 99999;
  min-width: 280px;
  max-width: 320px;
  max-height: 90vh;
  overflow-y: auto;
  pointer-events: auto;
  isolation: isolate;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.2);
}

.controls-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.controls-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: rgba(0,0,0,0.05) !important;
}

.controls-section {
  margin-bottom: 1.5rem;
}

.controls-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.color-picker-group {
  margin-bottom: 1rem;
}

.color-picker-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
}

.color-picker {
  width: 100%;
  height: 120px;
}

/* Custom scrollbar for the controls panel */
.vanta-controls::-webkit-scrollbar {
  width: 6px;
}

.vanta-controls::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.05);
  border-radius: 3px;
}

.vanta-controls::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.2);
  border-radius: 3px;
}

.vanta-controls::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.3);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .vanta-controls {
    top: 0.5rem;
    right: 0.5rem;
    left: 0.5rem;
    min-width: auto;
    max-width: none;
  }
}
</style>
