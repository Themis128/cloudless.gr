<template>
    <div ref="vantaRef" class="vanta-bg" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
let vantaEffect: any = null;
const vantaRef = ref<HTMLElement | null>(null);

onMounted(async () => {
    const VANTA = (await import('vanta/dist/vanta.clouds.min')).default;
    const THREE = (await import('three'));
    vantaEffect = VANTA({
        el: vantaRef.value,
        THREE,
        mouseControls: true,
        touchControls: true,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 0.6, // slightly larger clouds for more realism
        scaleMobile: 1.0,
        backgroundColor: 0xffffff, // white background
        skyColor: 0x59c0e0, // blue sky
        cloudColor: 0xc5cddb, // gray clouds
        cloudShadowColor: 0x51321, // dark cloud shadows
        sunColor: 0xff9919, // orange sun
        sunGlareColor: 0xff6633, // orange glare
        sunlightColor: 0xff9933, // warm sunlight
        showSun: true,
        sunPosition: [0.45, 0.22], // move sun slightly left and lower
        speed: 0.8, // set speed to 0.8 for a calmer effect
        zoom: 1.22, // moderate zoom for natural spacing
        cloudShadow: true,
        cloudShadowOpacity: 0.38, // slightly stronger shadow for contrast
        cloudOpacity: 0.88, // more body, less transparency
        lightDirection: [1, 0.35, 0.08], // lower sun angle for sunset
        cloudCover: 0.14, // patchy, sparse clouds
        cloudSpacing: 3.8, // more space between clouds
    });
});

onBeforeUnmount(() => {
    if (vantaEffect) vantaEffect.destroy();
});
</script>

<style scoped>
.vanta-bg {
    position: fixed;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    /* Cover the entire viewport */
    z-index: 0;
    pointer-events: none;
    /* Remove fade-out effect for full coverage */
    mask-image: none;
    -webkit-mask-image: none;
}
</style>
