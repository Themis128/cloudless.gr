<template>
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
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const currentStep = ref(1);
let intervalId: NodeJS.Timeout | null = null;

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

// Auto-advance stepper on desktop
onMounted(() => {
  if (process.client) {
    intervalId = setInterval(() => {
      if (currentStep.value < processSteps.length) {
        currentStep.value++;
      } else {
        currentStep.value = 1;
      }
    }, 4000);
  }
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});
</script>

<style scoped>
/* Section Styles */
.steps-section {
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

/* Responsive Design */
@media (max-width: 960px) {
  .steps-section {
    padding: 3rem 0;
  }

  .process-stepper {
    padding: 1rem;
  }
}

@media (max-width: 600px) {
  .section-header {
    margin-bottom: 2rem;
  }

  .timeline-card .v-card-title {
    font-size: 1rem;
  }
}
</style>
