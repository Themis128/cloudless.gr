// ...existing code...
<template>
  <div class="landing-page">
    <div class="glass-container">
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
import { useHead, definePageMeta } from 'nuxt/app';
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

// Verbose debugging and logging
import { onErrorCaptured, onMounted } from 'vue';
onMounted(() => {
  if (process.client) {
    console.log('[DEBUG] Landing page loaded');
    // Log environment variables (safe subset only)
    try {
      // Only log non-sensitive info
      // Nuxt 3: import.meta.env is available, but type guard for TS
      const env = (typeof import.meta.env !== 'undefined' ? import.meta.env : {}) as Record<string, string | undefined>;
      console.log('[DEBUG] SUPABASE_URL:', process.env.SUPABASE_URL || env.VITE_SUPABASE_URL);
      console.log('[DEBUG] SUPABASE_ANON_KEY length:', (process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').length);
    } catch (e) {
      console.error('[DEBUG] Error logging env vars:', e);
    }
    // Listen for global unhandledrejection and error events
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[DEBUG] Unhandled Promise rejection:', event.reason);
    });
    window.addEventListener('error', (event) => {
      console.error('[DEBUG] Window error:', event.error || event.message);
    });
  }
});

onErrorCaptured((err, instance, info) => {
  // Vue 3 error boundary
  console.error('[DEBUG] Vue error captured:', err, info);
  return false; // Let error propagate further
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

.glass-container {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 2rem;
  margin: 2rem auto;
  max-width: 1200px;
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
