<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <HeroSection />

    <!-- Stats Section -->
    <StatsSection />

    <!-- Features Carousel Section -->
    <FeaturesCarousel />

    <!-- Process Steps Section -->
    <ProcessSteps />

    <!-- Interactive Demo Section -->
    <InteractiveDemo />

    <!-- Features Tabs Section -->
    <FeaturesTabs />

    <!-- Testimonials Section -->
    <TestimonialsSection />

    <!-- Pricing Section -->
    <PricingSection />

    <!-- FAQ Section -->
    <FAQSection />

    <!-- CTA Section -->
    <CTASection />

    <!-- Footer -->
    <FooterSection />
  </div>
</template>

<script setup lang="ts">
// Import all landing page components
import CTASection from '~/components/landing/CTASection.vue';
import FAQSection from '~/components/landing/FAQSection.vue';
import FeaturesCarousel from '~/components/landing/FeaturesCarousel.vue';
import FeaturesTabs from '~/components/landing/FeaturesTabs.vue';
import FooterSection from '~/components/landing/FooterSection.vue';
import HeroSection from '~/components/landing/HeroSection.vue';
import InteractiveDemo from '~/components/landing/InteractiveDemo.vue';
import PricingSection from '~/components/landing/PricingSection.vue';
import ProcessSteps from '~/components/landing/ProcessSteps.vue';
import StatsSection from '~/components/landing/StatsSection.vue';
import TestimonialsSection from '~/components/landing/TestimonialsSection.vue';

// SEO and Meta
useHead({
  title: 'Cloudless.gr - Power Without the Code',
  meta: [
    {
      name: 'description',
      content: 'Run powerful analytics and cloud workflows with clicks, not code. Built for creators, not engineers. Try Cloudless.gr today.'
    },
    {
      name: 'keywords',
      content: 'no-code, cloud computing, analytics, workflow automation, data processing, business intelligence'
    },
    {
      property: 'og:title',
      content: 'Cloudless.gr - Power Without the Code'
    },
    {
      property: 'og:description',
      content: 'Run powerful analytics and cloud workflows with clicks, not code. Built for creators, not engineers.'
    },
    {
      property: 'og:type',
      content: 'website'
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image'
    },
    {
      name: 'twitter:title',
      content: 'Cloudless.gr - Power Without the Code'
    },
    {
      name: 'twitter:description',
      content: 'Run powerful analytics and cloud workflows with clicks, not code. Built for creators, not engineers.'
    }
  ]
});

definePageMeta({ 
  layout: 'default',
  name: 'Home',
  title: 'Cloudless.gr - Power Without the Code'
});

// Analytics tracking
onMounted(() => {
  // Track page view
  if (process.client) {
    console.log('Landing page loaded');
    // Add any analytics tracking here
  }
});
</script>

<style scoped>
/* Landing Page Layout */
.landing-page {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Section spacing */
.landing-page > * {
  margin-bottom: 2rem;
}

/* Last section no margin */
.landing-page > *:last-child {
  margin-bottom: 0;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .landing-page > * {
    margin-bottom: 1rem;
  }
}
</style>
