<template>
  <div class="landing-page">
    <!-- Hero Section -->
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

    <!-- Features Carousel Section -->
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

    <!-- Process Steps Section -->
    <section class="steps-section">
      <v-container>
        <div class="section-header text-center mb-8">
          <h2 class="section-title text-h4 font-weight-bold mb-3">How It Works</h2>
          <p class="section-subtitle text-h6 mx-auto">From data to insights in just a few clicks</p>
        </div>

        <!-- Mobile: Use Cards, Desktop: Use Stepper -->
        <v-stepper
          v-if="!$vuetify.display.mobile"
          v-model="currentStep"
          class="process-stepper"
          alt-labels
        >
          <v-stepper-header>
            <template v-for="(step, index) in processSteps" :key="index">
              <v-stepper-item
                :complete="currentStep > index + 1"
                :value="index + 1"
                :color="step.color"
              >
                <template #icon>
                  <v-icon>{{ step.icon }}</v-icon>
                </template>
                {{ step.title }}
              </v-stepper-item>
              <v-divider v-if="index < processSteps.length - 1" />
            </template>
          </v-stepper-header>

          <v-stepper-window>
            <v-stepper-window-item
              v-for="(step, index) in processSteps"
              :key="index"
              :value="index + 1"
            >
              <v-card class="stepper-card" elevation="2">
                <v-card-title class="d-flex align-center">
                  <v-icon :color="step.color" class="me-2">{{ step.icon }}</v-icon>
                  {{ step.title }}
                </v-card-title>
                <v-card-text>
                  <p class="mb-3">{{ step.description }}</p>
                  <v-chip-group>
                    <v-chip
                      v-for="tag in step.tags"
                      :key="tag"
                      size="small"
                      :color="step.color"
                      variant="tonal"
                    >
                      {{ tag }}
                    </v-chip>
                  </v-chip-group>
                </v-card-text>
              </v-card>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>

        <!-- Mobile Version: Timeline -->
        <v-timeline
          v-else
          density="compact"
          class="process-timeline"
          align="start"
          side="end"
        >
          <v-timeline-item
            v-for="(step, index) in processSteps"
            :key="index"
            :dot-color="step.color"
            size="small"
            class="timeline-item"
          >
            <template #icon>
              <v-icon size="20" color="white">{{ step.icon }}</v-icon>
            </template>

            <v-card class="timeline-card" elevation="4">
              <v-card-title class="d-flex align-center">
                <v-icon :color="step.color" class="me-2" size="20">{{ step.icon }}</v-icon>
                {{ step.title }}
              </v-card-title>
              <v-card-text>
                <p class="mb-2">{{ step.description }}</p>
                <v-chip-group>
                  <v-chip
                    v-for="tag in step.tags"
                    :key="tag"
                    size="x-small"
                    :color="step.color"
                    variant="tonal"
                  >
                    {{ tag }}
                  </v-chip>
                </v-chip-group>
              </v-card-text>
            </v-card>
          </v-timeline-item>
        </v-timeline>
      </v-container>
    </section>

    <!-- Interactive Demo Section -->
    <section class="demo-section">
      <v-container>
        <div class="section-header text-center mb-8">
          <h2 class="section-title text-h4 font-weight-bold mb-3">Interactive Demo</h2>
          <p class="section-subtitle text-h6 mx-auto">
            Experience the power of our comprehensive data analytics platform
          </p>
        </div>

        <div class="app-demo-section">
          <CloudlessDemo />
        </div>
      </v-container>
    </section>

    <!-- Features Tabs Section -->
    <section class="tabs-section">
      <v-container>
        <div class="section-header text-center mb-8">
          <h2 class="section-title text-h4 font-weight-bold mb-3">Why Choose Cloudless?</h2>
          <p class="section-subtitle text-h6 mx-auto">
            Everything you need for modern data analytics and cloud workflows
          </p>
        </div>

        <v-tabs
          v-model="activeTab"
          class="features-tabs"
          center-active
          show-arrows
        >
          <v-tab
            v-for="(category, index) in featureCategories"
            :key="index"
            :value="index"
            class="feature-tab"
          >
            <v-icon start>{{ category.icon }}</v-icon>
            {{ category.name }}
          </v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab" class="mt-6">
          <v-tabs-window-item
            v-for="(category, index) in featureCategories"
            :key="index"
            :value="index"
          >
            <v-row>
              <v-col
                v-for="(feature, fIndex) in category.features"
                :key="fIndex"
                cols="12"
                md="4"
              >
                <v-card class="feature-card h-100" elevation="4">
                  <v-card-title class="d-flex align-center">
                    <v-icon :color="feature.color" class="me-2">{{ feature.icon }}</v-icon>
                    {{ feature.title }}
                  </v-card-title>
                  <v-card-text>
                    <p>{{ feature.description }}</p>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-container>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

definePageMeta({ layout: 'default' });

const currentStep = ref(1);
const activeTab = ref(0);

const _goToAuth = () => {
  console.log('Navigating to /auth');
  navigateTo('/auth');
};

const goToInfo = () => {
  console.log('Navigating to /info');
  navigateTo('/info');
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

// Process Steps Data
const processSteps = [
  {
    title: 'Connect Data',
    description:
      'Link your data sources with our intuitive connectors. Support for databases, APIs, files, and cloud services.',
    icon: 'mdi-database-import',
    color: 'blue',
    tags: ['CSV', 'APIs', 'Databases', 'Cloud Storage'],
  },
  {
    title: 'Transform & Clean',
    description:
      'Use AI-powered tools to clean, transform, and prepare your data for analysis automatically.',
    icon: 'mdi-auto-fix',
    color: 'green',
    tags: ['Auto-Clean', 'Data Validation', 'Schema Detection'],
  },
  {
    title: 'Analyze & Mine',
    description:
      'Apply advanced analytics and data mining techniques to discover patterns and insights.',
    icon: 'mdi-chart-timeline-variant',
    color: 'purple',
    tags: ['Pattern Recognition', 'Machine Learning', 'Statistical Analysis'],
  },
  {
    title: 'Visualize Results',
    description: 'Create stunning dashboards and reports to share your findings with stakeholders.',
    icon: 'mdi-chart-line',
    color: 'orange',
    tags: ['Interactive Charts', 'Dashboards', 'Export Options'],
  },
  {
    title: 'Deploy & Scale',
    description:
      'Deploy your analytics workflows to the cloud with automatic scaling and monitoring.',
    icon: 'mdi-rocket-launch',
    color: 'red',
    tags: ['Auto-Scale', 'Monitoring', 'API Access'],
  },
];

// Feature Categories for Tabs
const featureCategories = [
  {
    name: 'Analytics',
    icon: 'mdi-chart-line',
    features: [
      {
        title: 'Predictive Analytics',
        description: 'Forecast trends and outcomes using advanced machine learning algorithms',
        icon: 'mdi-crystal-ball',
        color: 'primary',
      },
      {
        title: 'Real-time Dashboards',
        description:
          'Monitor your data with live, interactive dashboards that update automatically',
        icon: 'mdi-monitor-dashboard',
        color: 'success',
      },
      {
        title: 'Custom Reports',
        description: 'Generate detailed reports with automated scheduling and distribution',
        icon: 'mdi-file-chart',
        color: 'info',
      },
    ],
  },
  {
    name: 'Data Mining',
    icon: 'mdi-pickaxe',
    features: [
      {
        title: 'Pattern Recognition',
        description: 'Automatically identify patterns and anomalies in your datasets',
        icon: 'mdi-pattern',
        color: 'purple',
      },
      {
        title: 'Classification',
        description:
          'Organize and categorize your data using intelligent classification algorithms',
        icon: 'mdi-tag-multiple',
        color: 'deep-purple',
      },
      {
        title: 'Clustering Analysis',
        description: 'Group similar data points to discover hidden relationships and segments',
        icon: 'mdi-dots-hexagon',
        color: 'indigo',
      },
    ],
  },
  {
    name: 'Integration',
    icon: 'mdi-connection',
    features: [
      {
        title: 'API Connectivity',
        description: 'Connect to any REST API or web service with our flexible connector framework',
        icon: 'mdi-api',
        color: 'teal',
      },
      {
        title: 'Database Support',
        description:
          'Native support for SQL and NoSQL databases including PostgreSQL, MongoDB, and more',
        icon: 'mdi-database',
        color: 'cyan',
      },
      {
        title: 'Cloud Integration',
        description:
          'Seamlessly integrate with AWS, Azure, Google Cloud, and other cloud platforms',
        icon: 'mdi-cloud-sync',
        color: 'light-blue',
      },
    ],
  },
];

// Auto-advance stepper on desktop
if (process.client) {
  setInterval(() => {
    if (currentStep.value < processSteps.length) {
      currentStep.value++;
    } else {
      currentStep.value = 1;
    }
  }, 4000);
}
</script>

<style scoped>
/* Landing Page Layout */
.landing-page {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Hero Section */
.hero-section {
  min-height: 100vh;
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
  padding-block: 6rem;
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

/* Section Styles */
.carousel-section,
.steps-section,
.demo-section,
.tabs-section {
  padding: 4rem 0;
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
  margin-bottom: 3rem;
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

/* Stepper Styles */
.process-stepper {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.stepper-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
}

.stepper-card .v-card-title {
  color: #ffffff;
  font-weight: 600;
}

.stepper-card .v-card-text {
  color: rgba(255, 255, 255, 0.9);
}

/* Timeline Styles */
.process-timeline {
  max-width: 800px;
  margin: 0 auto;
}

.timeline-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 1rem;
  color: white;
}

.timeline-card .v-card-title {
  color: #ffffff;
  font-weight: 600;
  font-size: 1.1rem;
}

.timeline-card .v-card-text {
  color: rgba(255, 255, 255, 0.9);
}

/* Demo Section */
.app-demo-section {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 2rem;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  max-width: 1200px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  position: relative;
  margin: 0 auto;
}

.app-demo-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-radius: 24px;
  pointer-events: none;
}

.app-demo-section :deep(.demo-content h3) {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  margin-bottom: 16px;
  font-weight: 700;
}

.app-demo-section :deep(.workflow-container) {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Tabs Styles */
.features-tabs {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 2rem;
}

.feature-tab {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.feature-tab.v-tab--selected {
  color: #ffffff;
  font-weight: 600;
}

.feature-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #333333;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 1);
  border-color: rgba(255, 255, 255, 0.5);
}

.feature-card .v-card-title {
  color: #1a1a1a;
  font-weight: 600;
}

.feature-card .v-card-text {
  color: #333333;
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
  .hero-content {
    padding-block: 4rem;
  }

  .carousel-section,
  .steps-section,
  .demo-section,
  .tabs-section {
    padding: 3rem 0;
  }

  .app-demo-section {
    padding: 1.5rem;
    border-radius: 20px;
  }
}

@media (max-width: 600px) {
  .hero-content {
    padding-block: 3rem;
  }

  .section-header {
    margin-bottom: 2rem;
  }

  .app-demo-section {
    padding: 1rem;
    border-radius: 16px;
  }

  .process-stepper {
    padding: 1rem;
  }

  .timeline-card .v-card-title {
    font-size: 1rem;
  }
}
</style>
