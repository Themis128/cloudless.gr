<template>
  <div class="models-documentation-page">
    <PageStructure
      title="Model Training Documentation"
      subtitle="Learn to train and deploy custom AI models"
      :show-back-button="true"
      back-button-to="/documentation"
    >
      <template #main>
        <div class="documentation-content">
          <!-- Coming Soon Alert -->
          <v-alert
            type="info"
            variant="tonal"
            class="mb-6"
            prominent
          >
            <template #prepend>
              <v-icon>mdi-information</v-icon>
            </template>
            <h3 class="text-h6 mb-2">Model Training Documentation Coming Soon</h3>
            <p class="mb-3">
              We're working on comprehensive documentation for AI model training. 
              In the meantime, check out our quick start guide and existing resources.
            </p>
            <v-btn
              to="/documentation/models/quick-start"
              color="primary"
              variant="elevated"
              class="mr-2"
            >
              Quick Start Guide
            </v-btn>
            <v-btn
              to="/tutorials"
              color="secondary"
              variant="outlined"
            >
              Video Tutorials
            </v-btn>
          </v-alert>

          <!-- Quick Actions -->
          <v-row class="mb-6">
            <v-col cols="12" md="4">
              <v-card class="h-100" elevation="2">
                <v-card-text class="text-center">
                  <v-icon size="48" color="primary" class="mb-3">mdi-rocket-launch</v-icon>
                  <h4 class="text-h6 mb-2">Quick Start</h4>
                  <p class="text-body-2 mb-3">Get started with model training in 5 minutes</p>
                  <v-btn
                    to="/documentation/models/quick-start"
                    color="primary"
                    variant="elevated"
                  >
                    Start Now
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="h-100" elevation="2">
                <v-card-text class="text-center">
                  <v-icon size="48" color="secondary" class="mb-3">mdi-brain</v-icon>
                  <h4 class="text-h6 mb-2">Model Library</h4>
                  <p class="text-body-2 mb-3">Browse pre-trained models</p>
                  <v-btn
                    to="/models"
                    color="secondary"
                    variant="elevated"
                  >
                    Browse Models
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="h-100" elevation="2">
                <v-card-text class="text-center">
                  <v-icon size="48" color="success" class="mb-3">mdi-api</v-icon>
                  <h4 class="text-h6 mb-2">API Reference</h4>
                  <p class="text-body-2 mb-3">Model training API documentation</p>
                  <v-btn
                    to="/api-reference"
                    color="success"
                    variant="elevated"
                  >
                    View API
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Placeholder Content -->
          <v-card class="mb-6" elevation="1">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-construction</v-icon>
              Documentation Under Construction
            </v-card-title>
            <v-card-text>
              <p class="mb-4">
                We're building comprehensive documentation for model training. Here's what will be available soon:
              </p>
              <v-list>
                <v-list-item
                  v-for="item in upcomingFeatures"
                  :key="item.title"
                  :prepend-icon="item.icon"
                >
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                  <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Contact Section -->
          <v-card elevation="1">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-help-circle</v-icon>
              Need Help Now?
            </v-card-title>
            <v-card-text>
              <p class="mb-4">
                While we're working on the documentation, our support team is here to help:
              </p>
              <v-btn
                to="/support"
                color="primary"
                variant="elevated"
                class="mr-2 mb-2"
              >
                <v-icon left>mdi-headset</v-icon>
                Contact Support
              </v-btn>
              <v-btn
                to="/community"
                color="secondary"
                variant="outlined"
                class="mr-2 mb-2"
              >
                <v-icon left>mdi-forum</v-icon>
                Community Forum
              </v-btn>
              <v-btn
                href="mailto:support@cloudless.gr"
                color="info"
                variant="outlined"
                class="mb-2"
              >
                <v-icon left>mdi-email</v-icon>
                Email Us
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
  title: 'Model Training Documentation - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Learn to train and deploy custom AI models with Cloudless.gr. Documentation and guides for AI model development.' },
    { property: 'og:title', content: 'Model Training Documentation - Cloudless.gr' },
    { property: 'og:description', content: 'Comprehensive guides for AI model training and deployment.' }
  ]
})

const upcomingFeatures = [
  {
    title: 'Model Training Basics',
    description: 'Step-by-step guide to training your first AI model',
    icon: 'mdi-school'
  },
  {
    title: 'Data Preparation',
    description: 'How to prepare and format your training data',
    icon: 'mdi-database'
  },
  {
    title: 'Model Fine-tuning',
    description: 'Advanced techniques for improving model performance',
    icon: 'mdi-tune'
  },
  {
    title: 'Deployment Guide',
    description: 'Deploy your trained models to production',
    icon: 'mdi-rocket'
  },
  {
    title: 'Performance Monitoring',
    description: 'Monitor and optimize your deployed models',
    icon: 'mdi-chart-line'
  }
]
</script>

<style scoped>
.models-documentation-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.documentation-content {
  max-width: 1200px;
  margin: 0 auto;
}
</style>