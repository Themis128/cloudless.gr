<template>
  <div ref="vantaRef" class="vanta-bg" />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import CLOUDS from 'vanta/dist/vanta.clouds2.min'

const vantaRef = ref<HTMLElement | null>(null)
let vantaEffect: any = null

onMounted(() => {
  if (!vantaEffect) {
    vantaEffect = CLOUDS({
      el: vantaRef.value,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      backgroundColor: 0x000000,
      skyColor: 0x5ca6ca,
      cloudColor: 0x334d80,
      lightColor: 0xffffff,
      texturePath: './gallery/noise.png',
    })
  }
})

onBeforeUnmount(() => {
  if (vantaEffect) vantaEffect.destroy()
})
</script>

<style scoped>
.vanta-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
