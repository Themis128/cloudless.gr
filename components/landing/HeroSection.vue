<template>
  <section class="hero-section">
    <v-container
      fluid
      class="fill-height d-flex flex-column justify-center align-center text-center hero-content"
    >
      <h1 class="hero-title text-h3 text-md-h1 font-weight-bold mb-4">
        Cloudless: Power Without the Code
      </h1>

      <p class="hero-subtitle text-subtitle-1 text-md-h5 mb-6 mx-auto" style="max-width: 600px">
        Run powerful analytics and cloud workflows with clicks, not code. Built for creators, not
        engineers.
      </p>

      <!-- Trust Indicators -->
      <v-chip-group class="mb-6 d-flex justify-center flex-wrap">
        <v-chip color="success" variant="tonal" size="small">
          <v-icon start>mdi-shield-check</v-icon>
          Enterprise Security
        </v-chip>
        <v-chip color="info" variant="tonal" size="small">
          <v-icon start>mdi-clock-fast</v-icon>
          Deploy in Minutes
        </v-chip>
        <v-chip color="warning" variant="tonal" size="small">
          <v-icon start>mdi-code-tags-check</v-icon>
          No Code Required
        </v-chip>
      </v-chip-group>

      <div class="d-flex flex-wrap justify-center">
        <!-- Try It Free button, routes to /auth (auth/index.vue) -->
        <NuxtLink to="/auth" class="text-decoration-none">
          <v-btn
            color="primary"
            size="x-large"
            class="ma-2 px-8 py-4 primary-btn"
            aria-label="Start using Cloudless"
            prepend-icon="mdi-rocket-launch"
          >
            Try It Free
          </v-btn>
        </NuxtLink>
        <!-- Learn More button, routes to /info/index.vue -->
        <v-btn
          variant="outlined"
          color="white"
          size="x-large"
          class="ma-2 px-8 py-4 secondary-btn"
          aria-label="Learn more about Cloudless"
          prepend-icon="mdi-book-open"
          @click="goToInfo"
        >
          Learn More
        </v-btn>
      </div>
    </v-container>
  </section>
</template>

<script setup lang="ts">
const goToInfo = async () => {
  console.log('Navigating to /info');
  await navigateTo('/info');
};
</script>

<style scoped>
/* Hero Section */
.hero-section {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
}

.hero-content {
  position: relative;
  z-index: 2;
  color: white;
  padding-block: 4rem;
}

.hero-title {
  color: #ffffff;
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.8),
    0 4px 8px rgba(0, 0, 0, 0.3),
    0 0 20px rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, #ffffff 0%, #f0f8ff 50%, #e6f3ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 800 !important;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  color: rgba(255, 255, 255, 0.95);
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.7),
    0 4px 8px rgba(0, 0, 0, 0.2);
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

/* Button Styles */
.primary-btn {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  box-shadow:
    0 4px 12px rgba(25, 118, 210, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.primary-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 8px 25px rgba(25, 118, 210, 0.5),
    0 4px 8px rgba(0, 0, 0, 0.15);
}

.secondary-btn {
  border: 2px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.secondary-btn:hover {
  transform: translateY(-2px) scale(1.02);
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 1);
  box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
}

/* Trust Indicators */
.v-chip {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 500;
}

/* Responsive Design */
@media (max-width: 960px) {
  .hero-section {
    min-height: 60vh;
  }

  .hero-content {
    padding-block: 3rem;
  }
}

@media (max-width: 600px) {
  .hero-section {
    min-height: 50vh;
  }

  .hero-content {
    padding-block: 2rem;
  }
}
</style>
