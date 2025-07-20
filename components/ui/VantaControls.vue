<template>
  <div class="vanta-controls">
    <div class="controls-header">
      <h3>Sky Controls</h3>
      <v-btn
        icon
        size="small"
        class="close-btn"
        @click="handleClose"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>
    
    <div class="controls-section">
      <v-switch v-model="enabled" label="Animated Sky" color="primary" />
    </div>
    
    <div class="controls-section">
      <h4>Effect Type</h4>
      <select 
        v-model="selectedEffect"
        class="effect-select"
        @change="onSelectChange"
      >
        <option v-for="option in effectOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <div class="mt-2 text-caption text-grey">
        Current: {{ selectedEffect }} ({{ effectOptions.length }} effects available)
      </div>
    </div>
    
    <!-- Clouds2 Controls -->
    <div v-if="selectedEffect === 'clouds2'" class="controls-section">
      <h4>Animation</h4>
      <v-slider 
        v-model="speed" 
        :min="0.1" 
        :max="5" 
        :step="0.05" 
        label="Cloud Speed" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="cloudDensity" 
        :min="0.1" 
        :max="4" 
        :step="0.05" 
        label="Cloud Density" 
        color="primary"
        thumb-label
      />
    </div>
    
    <!-- Net/Topology Controls -->
    <div v-if="['net', 'topology'].includes(selectedEffect)" class="controls-section">
      <h4>Network Properties</h4>
      <v-slider 
        v-model="points" 
        :min="3" 
        :max="30" 
        :step="1" 
        label="Points" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="maxDistance" 
        :min="10" 
        :max="50" 
        :step="1" 
        label="Max Distance" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="spacing" 
        :min="10" 
        :max="40" 
        :step="1" 
        label="Spacing" 
        color="primary"
        thumb-label
      />
    </div>
    
    <!-- Waves Controls -->
    <div v-if="selectedEffect === 'waves'" class="controls-section">
      <h4>Wave Properties</h4>
      <v-slider 
        v-model="waveHeight" 
        :min="5" 
        :max="50" 
        :step="1" 
        label="Wave Height" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="waveSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.05" 
        label="Wave Speed" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="shininess" 
        :min="10" 
        :max="50" 
        :step="1" 
        label="Shininess" 
        color="primary"
        thumb-label
      />
    </div>
    
    <!-- Birds Controls -->
    <div v-if="selectedEffect === 'birds'" class="controls-section">
      <h4>Bird Properties</h4>
      <v-slider 
        v-model="birdSize" 
        :min="0.5" 
        :max="3" 
        :step="0.1" 
        label="Bird Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="quantity" 
        :min="1" 
        :max="10" 
        :step="1" 
        label="Quantity" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="speedLimit" 
        :min="1" 
        :max="10" 
        :step="0.5" 
        label="Speed Limit" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Cells Controls -->
    <div v-if="selectedEffect === 'cells'" class="controls-section">
      <h4>Cell Properties</h4>
      <v-slider 
        v-model="cellSize" 
        :min="0.1" 
        :max="2" 
        :step="0.1" 
        label="Cell Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="cellSpeed" 
        :min="0.1" 
        :max="5" 
        :step="0.1" 
        label="Cell Speed" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Dots Controls -->
    <div v-if="selectedEffect === 'dots'" class="controls-section">
      <h4>Dot Properties</h4>
      <v-slider 
        v-model="dotSize" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Dot Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="dotSpeed" 
        :min="0.1" 
        :max="5" 
        :step="0.1" 
        label="Dot Speed" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Fog Controls -->
    <div v-if="selectedEffect === 'fog'" class="controls-section">
      <h4>Fog Properties</h4>
      <v-slider 
        v-model="fogSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Fog Speed" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="fogDensity" 
        :min="0.1" 
        :max="2" 
        :step="0.1" 
        label="Fog Density" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Globe Controls -->
    <div v-if="selectedEffect === 'globe'" class="controls-section">
      <h4>Globe Properties</h4>
      <v-slider 
        v-model="globeSize" 
        :min="0.5" 
        :max="3" 
        :step="0.1" 
        label="Globe Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="globeSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Globe Speed" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Halo Controls -->
    <div v-if="selectedEffect === 'halo'" class="controls-section">
      <h4>Halo Properties</h4>
      <v-slider 
        v-model="haloSize" 
        :min="0.5" 
        :max="3" 
        :step="0.1" 
        label="Halo Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="haloSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Halo Speed" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Ripple Controls -->
    <div v-if="selectedEffect === 'ripple'" class="controls-section">
      <h4>Ripple Properties</h4>
      <v-slider 
        v-model="rippleSize" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Ripple Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="rippleSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Ripple Speed" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Rings Controls -->
    <div v-if="selectedEffect === 'rings'" class="controls-section">
      <h4>Ring Properties</h4>
      <v-slider 
        v-model="ringSize" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Ring Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="ringSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Ring Speed" 
        color="primary"
        thumb-label
      />
    </div>

    <!-- Trunk Controls -->
    <div v-if="selectedEffect === 'trunk'" class="controls-section">
      <h4>Trunk Properties</h4>
      <v-slider 
        v-model="trunkSize" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Trunk Size" 
        color="primary"
        thumb-label
      />
      <v-slider 
        v-model="trunkSpeed" 
        :min="0.1" 
        :max="3" 
        :step="0.1" 
        label="Trunk Speed" 
        color="primary"
        thumb-label
      />
    </div>
    
    <div v-if="selectedEffect === 'clouds2'" class="controls-section">
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
    
    <div v-if="selectedEffect === 'clouds2'" class="controls-section">
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
        :max="3" 
        :step="0.05" 
        label="Light Intensity" 
        color="primary"
        thumb-label
      />
    </div>
    
    <div class="controls-section">
      <h4>Colors</h4>
      <div v-if="selectedEffect === 'clouds2'" class="color-picker-group">
        <label>Sky Color</label>
        <v-color-picker 
          v-model="skyColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'clouds2'" class="color-picker-group">
        <label>Cloud Color</label>
        <v-color-picker 
          v-model="cloudColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'clouds2'" class="color-picker-group">
        <label>Light Color</label>
        <v-color-picker 
          v-model="lightColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="['net', 'topology'].includes(selectedEffect)" class="color-picker-group">
        <label>Background Color</label>
        <v-color-picker 
          v-model="backgroundColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="['net', 'topology'].includes(selectedEffect)" class="color-picker-group">
        <label>Line Color</label>
        <v-color-picker 
          v-model="lineColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="['net', 'topology'].includes(selectedEffect)" class="color-picker-group">
        <label>Point Color</label>
        <v-color-picker 
          v-model="pointColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'waves'" class="color-picker-group">
        <label>Background Color</label>
        <v-color-picker 
          v-model="backgroundColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'waves'" class="color-picker-group">
        <label>Wave Color</label>
        <v-color-picker 
          v-model="waveColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'birds'" class="color-picker-group">
        <label>Background Color</label>
        <v-color-picker 
          v-model="backgroundColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'birds'" class="color-picker-group">
        <label>Bird Color 1</label>
        <v-color-picker 
          v-model="color1" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="selectedEffect === 'birds'" class="color-picker-group">
        <label>Bird Color 2</label>
        <v-color-picker 
          v-model="color2" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="['cells', 'dots', 'fog', 'globe', 'halo', 'ripple', 'rings', 'trunk'].includes(selectedEffect)" class="color-picker-group">
        <label>Background Color</label>
        <v-color-picker 
          v-model="backgroundColor" 
          hide-inputs 
          mode="hex"
          class="color-picker"
        />
      </div>
      <div v-if="['cells', 'dots'].includes(selectedEffect)" class="color-picker-group">
        <label>Element Color</label>
        <v-color-picker 
          v-model="elementColor" 
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
        variant="outlined" 
        color="primary" 
        block
        @click="resetToDefaults"
      >
        Reset to Defaults
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  initial: {
    type: Object,
    default: () => ({})
  }
})
const emit = defineEmits(['update', 'close'])

const enabled = ref(true)
const selectedEffect = ref(props.initial?.selectedEffect || 'clouds2')
const speed = ref(props.initial?.speed ?? 2.5)
const cloudHeight = ref(props.initial?.cloudHeight ?? 1.2)
const cloudDensity = ref(props.initial?.cloudDensity ?? 2.5)
const cloudScale = ref(props.initial?.cloudScale ?? 1.5)
const lightDirection = ref(props.initial?.lightDirection ?? 1.8)
const lightIntensity = ref(props.initial?.lightIntensity ?? 1.8)
const skyColor = ref(props.initial?.skyColor ?? '#4a5b8a')
const cloudColor = ref(props.initial?.cloudColor ?? '#d0d8f0')
const lightColor = ref(props.initial?.lightColor ?? '#ffffff')
const backgroundColor = ref(props.initial?.backgroundColor ?? '#1a1a2e')
const lineColor = ref(props.initial?.lineColor ?? '#ff6b6b')
const pointColor = ref(props.initial?.pointColor ?? '#4ecdc4')
const waveColor = ref(props.initial?.waveColor ?? '#4ecdc4')
const color1 = ref(props.initial?.color1 ?? '#ff6b6b')
const color2 = ref(props.initial?.color2 ?? '#4ecdc4')
const points = ref(props.initial?.points ?? 15.0)
const maxDistance = ref(props.initial?.maxDistance ?? 25.0)
const spacing = ref(props.initial?.spacing ?? 20.0)
const waveHeight = ref(props.initial?.waveHeight ?? 20.0)
const waveSpeed = ref(props.initial?.waveSpeed ?? 1.05)
const shininess = ref(props.initial?.shininess ?? 27.0)
const birdSize = ref(props.initial?.birdSize ?? 1.5)
const quantity = ref(props.initial?.quantity ?? 3.0)
const speedLimit = ref(props.initial?.speedLimit ?? 4.0)
const mouseControls = ref(props.initial?.mouseControls ?? true)
const touchControls = ref(props.initial?.touchControls ?? true)
const gyroControls = ref(props.initial?.gyroControls ?? false)
const reducedMotion = ref(props.initial?.reducedMotion ?? false)
const quality = ref(props.initial?.quality ?? 1.0)

// New effect properties
const cellSize = ref(props.initial?.cellSize ?? 1.0)
const cellSpeed = ref(props.initial?.cellSpeed ?? 1.0)
const dotSize = ref(props.initial?.dotSize ?? 1.0)
const dotSpeed = ref(props.initial?.dotSpeed ?? 1.0)
const fogSpeed = ref(props.initial?.fogSpeed ?? 1.0)
const fogDensity = ref(props.initial?.fogDensity ?? 1.0)
const globeSize = ref(props.initial?.globeSize ?? 1.0)
const globeSpeed = ref(props.initial?.globeSpeed ?? 1.0)
const haloSize = ref(props.initial?.haloSize ?? 1.0)
const haloSpeed = ref(props.initial?.haloSpeed ?? 1.0)
const rippleSize = ref(props.initial?.rippleSize ?? 1.0)
const rippleSpeed = ref(props.initial?.rippleSpeed ?? 1.0)
const ringSize = ref(props.initial?.ringSize ?? 1.0)
const ringSpeed = ref(props.initial?.ringSpeed ?? 1.0)
const trunkSize = ref(props.initial?.trunkSize ?? 1.0)
const trunkSpeed = ref(props.initial?.trunkSpeed ?? 1.0)
const elementColor = ref(props.initial?.elementColor ?? '#4ecdc4')

const effectOptions = ref([
  { value: 'clouds2', label: 'Clouds 2.0 - Enhanced Sky' },
  { value: 'clouds', label: 'Clouds - Classic Sky' },
  { value: 'birds', label: 'Birds - Flying Animation' },
  { value: 'cells', label: 'Cells - Cellular Patterns' },
  { value: 'dots', label: 'Dots - Animated Particles' },
  { value: 'fog', label: 'Fog - Atmospheric Mist' },
  { value: 'globe', label: 'Globe - 3D Earth' },
  { value: 'halo', label: 'Halo - Ring Effects' },
  { value: 'net', label: 'Net - Network Connections' },
  { value: 'ripple', label: 'Ripple - Water Waves' },
  { value: 'rings', label: 'Rings - Concentric Circles' },
  { value: 'topology', label: 'Topology - Geometric Patterns' },
  { value: 'trunk', label: 'Trunk - Tree Branches' },
  { value: 'waves', label: 'Waves - Ocean Surface' }
])

const handleClose = () => {
  emit('close')
}

const onEffectChange = (effect: string) => {
  console.log('Effect changed to:', effect)
  selectedEffect.value = effect
  resetToDefaults() // Reset all properties to defaults for the new effect
  
  // Add a small delay to allow smooth transition
  setTimeout(() => {
    emitUpdate()
  }, 100)
}

const onSelectChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  if (target) {
    onEffectChange(target.value)
  }
}

const resetToDefaults = () => {
  enabled.value = true
  
  // Reset based on selected effect
  switch (selectedEffect.value) {
    case 'clouds2':
      speed.value = 2.5
      cloudHeight.value = 1.2
      cloudDensity.value = 2.5
      cloudScale.value = 1.5
      lightDirection.value = 1.8
      lightIntensity.value = 1.8
      skyColor.value = '#4a5b8a'
      cloudColor.value = '#d0d8f0'
      lightColor.value = '#ffffff'
      break
    case 'net':
      points.value = 15.0
      maxDistance.value = 25.0
      spacing.value = 20.0
      backgroundColor.value = '#1a1a2e'
      lineColor.value = '#ff6b6b'
      pointColor.value = '#4ecdc4'
      break
    case 'topology':
      points.value = 6.0
      maxDistance.value = 25.0
      spacing.value = 20.0
      backgroundColor.value = '#0f0f23'
      lineColor.value = '#667eea'
      pointColor.value = '#f093fb'
      break
    case 'waves':
      waveHeight.value = 20.0
      waveSpeed.value = 1.05
      shininess.value = 27.0
      backgroundColor.value = '#0f0f23'
      waveColor.value = '#4ecdc4'
      break
    case 'birds':
      birdSize.value = 1.5
      quantity.value = 3.0
      speedLimit.value = 4.0
      backgroundColor.value = '#0f0f23'
      color1.value = '#ff6b6b'
      color2.value = '#4ecdc4'
      break
    case 'cells':
      cellSize.value = 1.0
      cellSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      elementColor.value = '#4ecdc4'
      break
    case 'dots':
      dotSize.value = 1.0
      dotSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      elementColor.value = '#4ecdc4'
      break
    case 'fog':
      fogSpeed.value = 1.0
      fogDensity.value = 1.0
      backgroundColor.value = '#0f0f23'
      break
    case 'globe':
      globeSize.value = 1.0
      globeSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      break
    case 'halo':
      haloSize.value = 1.0
      haloSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      break
    case 'ripple':
      rippleSize.value = 1.0
      rippleSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      break
    case 'rings':
      ringSize.value = 1.0
      ringSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      break
    case 'trunk':
      trunkSize.value = 1.0
      trunkSpeed.value = 1.0
      backgroundColor.value = '#0f0f23'
      break
  }
  
  mouseControls.value = true
  touchControls.value = true
  gyroControls.value = false
  reducedMotion.value = false
  quality.value = 1.0
}

// Function to emit updates immediately
const emitUpdate = () => {
  nextTick(() => {
    const updateData: any = {
      enabled: enabled.value,
      selectedEffect: selectedEffect.value,
      mouseControls: mouseControls.value,
      touchControls: touchControls.value,
      gyroControls: gyroControls.value,
      reducedMotion: reducedMotion.value,
      quality: quality.value
    }
    
    console.log('Emitting Vanta update:', updateData)

    // Add effect-specific properties
    switch (selectedEffect.value) {
      case 'clouds2':
        updateData.speed = reducedMotion.value ? 0.2 : speed.value
        updateData.cloudHeight = cloudHeight.value
        updateData.cloudDensity = cloudDensity.value
        updateData.cloudScale = cloudScale.value
        updateData.lightDirection = lightDirection.value
        updateData.lightIntensity = lightIntensity.value
        updateData.skyColor = skyColor.value
        updateData.cloudColor = cloudColor.value
        updateData.lightColor = lightColor.value
        break
          case 'net':
      updateData.points = points.value
      updateData.maxDistance = maxDistance.value
      updateData.spacing = spacing.value
      updateData.backgroundColor = backgroundColor.value
      updateData.color = lineColor.value
      updateData.showDots = true
      break
    case 'topology':
      updateData.backgroundColor = backgroundColor.value
      updateData.color = lineColor.value
      break
          case 'waves':
      updateData.waveHeight = waveHeight.value
      updateData.waveSpeed = waveSpeed.value
      updateData.shininess = shininess.value
      updateData.backgroundColor = backgroundColor.value
      updateData.color = waveColor.value
      break
          case 'birds':
      updateData.birdSize = birdSize.value
      updateData.quantity = quantity.value
      updateData.speedLimit = speedLimit.value
      updateData.backgroundColor = backgroundColor.value
      updateData.color1 = color1.value
      updateData.color2 = color2.value
      break
    case 'cells':
      updateData.size = cellSize.value
      updateData.speed = cellSpeed.value
      updateData.backgroundColor = backgroundColor.value
      updateData.color1 = color1.value
      updateData.color2 = color2.value
      break
    case 'dots':
      updateData.dotSize = dotSize.value
      updateData.dotSpeed = dotSpeed.value
      updateData.backgroundColor = backgroundColor.value
      updateData.elementColor = elementColor.value
      break
    case 'fog':
      updateData.fogSpeed = fogSpeed.value
      updateData.fogDensity = fogDensity.value
      updateData.backgroundColor = backgroundColor.value
      break
    case 'globe':
      updateData.globeSize = globeSize.value
      updateData.globeSpeed = globeSpeed.value
      updateData.backgroundColor = backgroundColor.value
      break
    case 'halo':
      updateData.haloSize = haloSize.value
      updateData.haloSpeed = haloSpeed.value
      updateData.backgroundColor = backgroundColor.value
      break
    case 'ripple':
      updateData.rippleSize = rippleSize.value
      updateData.rippleSpeed = rippleSpeed.value
      updateData.backgroundColor = backgroundColor.value
      break
    case 'rings':
      updateData.ringSize = ringSize.value
      updateData.ringSpeed = ringSpeed.value
      updateData.backgroundColor = backgroundColor.value
      break
    case 'trunk':
      updateData.trunkSize = trunkSize.value
      updateData.trunkSpeed = trunkSpeed.value
      updateData.backgroundColor = backgroundColor.value
      break
    }

    emit('update', updateData)
  })
}

// Watch all reactive properties and emit updates immediately
watch([
  enabled, selectedEffect, speed, cloudHeight, cloudDensity, cloudScale, 
  lightDirection, lightIntensity, skyColor, cloudColor, lightColor,
  backgroundColor, lineColor, pointColor, waveColor, color1, color2,
  points, maxDistance, spacing, waveHeight, waveSpeed, shininess,
  birdSize, quantity, speedLimit,
  cellSize, cellSpeed, dotSize, dotSpeed, fogSpeed, fogDensity,
  globeSize, globeSpeed, haloSize, haloSpeed, rippleSize, rippleSpeed,
  ringSize, ringSpeed, trunkSize, trunkSpeed, elementColor,
  mouseControls, touchControls, gyroControls, reducedMotion, quality
], () => {
  emitUpdate()
}, { flush: 'post' })
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
  transition: all 0.3s ease-in-out;
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
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

/* Select styling */
.effect-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(0,0,0,0.2);
  border-radius: 8px;
  background: white;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.effect-select:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.effect-select:hover {
  border-color: rgba(0,0,0,0.3);
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
