<template>
  <div class="models-quick-start-page">
    <PageStructure
      title="Model Training Quick Start"
      subtitle="Coming Soon - AI Model Training Made Simple"
      :show-back-button="true"
      back-button-to="/documentation/models"
    >
      <template #main>
        <div class="quick-start-content">
          <!-- Coming Soon Alert -->
          <v-alert
            type="warning"
            variant="tonal"
            class="mb-6"
            prominent
          >
            <template #prepend>
              <v-icon>mdi-construction</v-icon>
            </template>
            <h3 class="text-h6 mb-2">Model Training Quick Start - Coming Soon!</h3>
            <p class="mb-3">
              We're working hard to bring you an amazing model training experience. 
              This feature will be available in the next update.
            </p>
            <div class="mt-4">
              <v-btn
                to="/bots/builder"
                color="primary"
                variant="elevated"
                class="mr-2"
              >
                <v-icon left>mdi-robot</v-icon>
                Try Bot Builder Instead
              </v-btn>
              <v-btn
                to="/support"
                color="warning"
                variant="outlined"
              >
                <v-icon left>mdi-bell</v-icon>
                Get Notified
              </v-btn>
            </div>
          </v-alert>

          <!-- What's Coming -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-star</v-icon>
              What's Coming in Model Training
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col
                  v-for="feature in comingFeatures"
                  :key="feature.title"
                  cols="12"
                  md="6"
                >
                  <div class="feature-item">
                    <v-icon :color="feature.color" size="32" class="mb-2">
                      {{ feature.icon }}
                    </v-icon>
                    <h4 class="text-h6 mb-2">{{ feature.title }}</h4>
                    <p class="text-body-2">{{ feature.description }}</p>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Alternative Actions -->
          <v-card class="mb-6" elevation="1">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-lightbulb</v-icon>
              What You Can Do Now
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-card class="h-100 text-center" elevation="0" variant="outlined">
                    <v-card-text>
                      <v-icon size="48" color="primary" class="mb-3">mdi-robot</v-icon>
                      <h4 class="text-h6 mb-2">Build Bots</h4>
                      <p class="text-body-2 mb-3">Create AI chatbots with our visual builder</p>
                      <v-btn
                        to="/bots/builder"
                        color="primary"
                        variant="elevated"
                      >
                        Start Building
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="4">
                  <v-card class="h-100 text-center" elevation="0" variant="outlined">
                    <v-card-text>
                      <v-icon size="48" color="secondary" class="mb-3">mdi-pipeline</v-icon>
                      <h4 class="text-h6 mb-2">Create Pipelines</h4>
                      <p class="text-body-2 mb-3">Build data processing workflows</p>
                      <v-btn
                        to="/pipelines"
                        color="secondary"
                        variant="elevated"
                      >
                        View Pipelines
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="4">
                  <v-card class="h-100 text-center" elevation="0" variant="outlined">
                    <v-card-text>
                      <v-icon size="48" color="success" class="mb-3">mdi-book-open</v-icon>
                      <h4 class="text-h6 mb-2">Read Tutorials</h4>
                      <p class="text-body-2 mb-3">Learn AI development best practices</p>
                      <v-btn
                        to="/tutorials"
                        color="success"
                        variant="elevated"
                      >
                        Browse Tutorials
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Stay Updated -->
          <v-card elevation="1">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-email</v-icon>
              Stay Updated
            </v-card-title>
            <v-card-text>
              <p class="mb-4">
                Want to be the first to know when model training is available? 
                Contact our team to get notified!
              </p>
              <v-btn
                href="mailto:support@cloudless.gr?subject=Notify me about Model Training"
                color="info"
                variant="elevated"
                class="mr-2 mb-2"
              >
                <v-icon left>mdi-email</v-icon>
                Email Notification
              </v-btn>
              <v-btn
                to="/community"
                color="success"
                variant="outlined"
                class="mr-2 mb-2"
              >
                <v-icon left>mdi-forum</v-icon>
                Join Community
              </v-btn>
              <v-btn
                to="/support"
                color="primary"
                variant="outlined"
                class="mb-2"
              >
                <v-icon left>mdi-help</v-icon>
                Contact Support
              </v-btn>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import PageStructure from '~/components/layout/PageStructure.vue'

// Set page meta
useHead({
  title: 'Model Training Quick Start - Coming Soon - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Model training quick start guide coming soon to Cloudless.gr. Build AI models with ease.' },
    { property: 'og:title', content: 'Model Training Quick Start - Coming Soon - Cloudless.gr' },
    { property: 'og:description', content: 'AI model training made simple - coming soon to Cloudless.gr platform.' }
  ]
})

const comingFeatures = [
  {
    title: 'Visual Training Interface',
    description: 'Drag-and-drop interface for setting up model training pipelines',
    icon: 'mdi-view-dashboard',
    color: 'primary'
  },
  {
    title: 'Auto Data Preparation',
    description: 'Automatic data cleaning, formatting, and preprocessing',
    icon: 'mdi-auto-fix',
    color: 'secondary'
  },
  {
    title: 'Model Templates',
    description: 'Pre-configured templates for common AI model types',
    icon: 'mdi-file-document-multiple',
    color: 'success'
  },
  {
    title: 'Real-time Monitoring',
    description: 'Track training progress and model performance in real-time',
    icon: 'mdi-chart-line',
    color: 'info'
  },
  {
    title: 'One-Click Deployment',
    description: 'Deploy trained models to production with a single click',
    icon: 'mdi-rocket',
    color: 'warning'
  },
  {
    title: 'Advanced Analytics',
    description: 'Detailed insights into model performance and optimization suggestions',
    icon: 'mdi-analytics',
    color: 'error'
  }
]
</script>

<style scoped>
.models-quick-start-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.quick-start-content {
  max-width: 1000px;
  margin: 0 auto;
}

.feature-item {
  text-align: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  margin-bottom: 1rem;
  height: 100%;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .feature-item {
    margin-bottom: 1rem;
  }
}
</style>