<template>
  <section class="carousel-section">
    <v-container>
      <div class="section-header text-center mb-8">
        <h2 class="section-title text-h4 font-weight-bold mb-3">Discover Our Capabilities</h2>
        <p class="section-subtitle text-h6 mx-auto">
          Explore the full range of our no-code analytics platform
        </p>
      </div>

      <v-carousel
        :height="$vuetify.display.mobile ? 320 : 400"
        hide-delimiter-background
        show-arrows="hover"
        cycle
        interval="6000"
        class="features-carousel"
      >
        <v-carousel-item
          v-for="(feature, index) in carouselFeatures"
          :key="index"
          :value="index"
          class="carousel-item"
        >
          <v-sheet class="d-flex align-center justify-center carousel-content" height="100%">
            <v-container>
              <v-row align="center" justify="center">
                <v-col cols="12" md="6" class="text-center">
                  <v-avatar
                    :size="$vuetify.display.mobile ? 60 : 80"
                    :color="feature.color"
                    class="mb-4"
                  >
                    <v-icon :size="$vuetify.display.mobile ? 30 : 40" color="white">{{
                      feature.icon
                    }}</v-icon>
                  </v-avatar>
                  <h3 class="carousel-title text-h5 text-md-h4 font-weight-bold mb-3">
                    {{ feature.title }}
                  </h3>
                  <p class="carousel-description text-body-1 text-md-h6 mb-4">
                    {{ feature.description }}
                  </p>
                  <v-btn
                    :color="feature.color"
                    variant="elevated"
                    :size="$vuetify.display.mobile ? 'default' : 'large'"
                    class="carousel-btn"
                    @click="feature.action"
                  >
                    {{ feature.buttonText }}
                    <v-icon end>{{ feature.buttonIcon }}</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
            </v-container>
          </v-sheet>
        </v-carousel-item>
      </v-carousel>
    </v-container>
  </section>
</template>

<script setup lang="ts">
const goToInfo = async () => {
  console.log('Navigating to /info');
  await navigateTo('/info');
};

// Carousel Features Data
const carouselFeatures = [
  {
    title: 'AI-Powered Analytics',
    description:
      'Leverage advanced machine learning to extract insights from your data automatically',
    icon: 'mdi-brain',
    color: 'primary',
    buttonText: 'Explore AI',
    buttonIcon: 'mdi-arrow-right',
    action: () => goToInfo(),
  },
  {
    title: 'Real-Time Processing',
    description: 'Process massive datasets in real-time with our optimized cloud infrastructure',
    icon: 'mdi-lightning-bolt',
    color: 'success',
    buttonText: 'See Speed',
    buttonIcon: 'mdi-speedometer',
    action: () => goToInfo(),
  },
  {
    title: 'No-Code Solutions',
    description: 'Build complex analytics workflows without writing a single line of code',
    icon: 'mdi-code-tags-check',
    color: 'warning',
    buttonText: 'Start Building',
    buttonIcon: 'mdi-hammer-wrench',
    action: () => navigateTo('/auth'),
  },
  {
    title: 'Enterprise Security',
    description: 'Bank-level security with compliance standards that meet enterprise requirements',
    icon: 'mdi-shield-crown',
    color: 'error',
    buttonText: 'Learn Security',
    buttonIcon: 'mdi-security',
    action: () => goToInfo(),
  },
];
</script>

<style scoped>
/* Section Styles */
.carousel-section {
  padding: 2rem 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.02) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.02) 100%
  );
  position: relative;
  z-index: 1;
}

.section-header {
  margin-bottom: 2rem;
}

.section-title {
  color: #ffffff;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.6);
  font-weight: 700;
  margin-bottom: 1rem;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  font-weight: 400;
  max-width: 600px;
  margin: 0 auto;
}

/* Carousel Styles */
.features-carousel {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.carousel-content {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.carousel-title {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  font-weight: 700;
}

.carousel-description {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  line-height: 1.6;
}

.carousel-btn {
  min-width: 160px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

/* Responsive Design */
@media (max-width: 960px) {
  .carousel-section {
    padding: 3rem 0;
  }
}

@media (max-width: 600px) {
  .section-header {
    margin-bottom: 2rem;
  }
}
</style>
