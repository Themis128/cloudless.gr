<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <HeroSection />

    <!-- Features Carousel Section -->
    <FeaturesCarousel />

    <!-- Process Steps Section -->
    <ProcessSteps />

    <!-- Interactive Demo Section -->
    <InteractiveDemo />

    <!-- Features Tabs Section -->
    <FeaturesTabs />
  </div>
</template>

<script setup lang="ts">
// Import all landing page components
import FeaturesCarousel from '~/components/landing/FeaturesCarousel.vue';
import FeaturesTabs from '~/components/landing/FeaturesTabs.vue';
import HeroSection from '~/components/landing/HeroSection.vue';
import InteractiveDemo from '~/components/landing/InteractiveDemo.vue';
import ProcessSteps from '~/components/landing/ProcessSteps.vue';

definePageMeta({ layout: 'default' });
</script>

<style scoped>
/* Landing Page Layout */
.landing-page {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}
</style>
