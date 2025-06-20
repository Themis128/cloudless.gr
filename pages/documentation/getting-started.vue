<template>
  <div class="getting-started-page">
    <!-- Header -->
    <div class="page-header">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        @click="navigateTo('/documentation')"
      >
        Back to Documentation
      </v-btn>

      <div class="header-content">
        <h1 class="text-h3 font-weight-bold mb-2">
          <v-icon icon="mdi-rocket-launch" class="me-3" color="primary" />
          Getting Started
        </h1>
        <p class="text-h6 text-medium-emphasis">
          Get up and running with Cloudless.gr in just a few minutes
        </p>
      </div>
    </div>

    <!-- Progress Steps -->
    <v-card class="progress-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">Quick Start Progress</h3>
        <v-stepper v-model="currentStep" :items="steps" class="custom-stepper">
          <template #item.1>
            <div class="step-content">
              <h4 class="text-h6 font-weight-bold mb-3">Create Your Account</h4>
              <p class="text-body-2 mb-4">
                Sign up for a free account to start building ML projects. No credit card required.
              </p>
              <v-btn color="primary" variant="outlined" @click="navigateTo('/auth/signup')">
                Sign Up Now
              </v-btn>
            </div>
          </template>

          <template #item.2>
            <div class="step-content">
              <h4 class="text-h6 font-weight-bold mb-3">Choose a Template</h4>
              <p class="text-body-2 mb-4">
                Select from our pre-built templates for common ML use cases like image
                classification, NLP, and more.
              </p>
              <v-btn color="primary" variant="outlined" @click="navigateTo('/projects/templates')">
                Browse Templates
              </v-btn>
            </div>
          </template>

          <template #item.3>
            <div class="step-content">
              <h4 class="text-h6 font-weight-bold mb-3">Create Your First Project</h4>
              <p class="text-body-2 mb-4">
                Set up your project with the visual pipeline builder and start training your model.
              </p>
              <v-btn color="primary" variant="outlined" @click="navigateTo('/projects/create')">
                Create Project
              </v-btn>
            </div>
          </template>

          <template #item.4>
            <div class="step-content">
              <h4 class="text-h6 font-weight-bold mb-3">Deploy & Monitor</h4>
              <p class="text-body-2 mb-4">
                Deploy your trained model with one click and monitor its performance in real-time.
              </p>
              <v-btn
                color="primary"
                variant="outlined"
                @click="navigateTo('/documentation/deployment')"
              >
                Learn More
              </v-btn>
            </div>
          </template>
        </v-stepper>
      </v-card-text>
    </v-card>

    <!-- Key Features -->
    <v-card class="features-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-star" class="me-2" color="primary" />
          Key Features
        </h3>
        <v-row>
          <v-col v-for="feature in keyFeatures" :key="feature.title" cols="12" md="6" lg="4">
            <div class="feature-item">
              <v-icon :icon="feature.icon" color="primary" size="32" class="mb-3" />
              <h4 class="text-h6 font-weight-bold mb-2">{{ feature.title }}</h4>
              <p class="text-body-2 text-medium-emphasis">{{ feature.description }}</p>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Quick Actions -->
    <v-card class="quick-actions-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-lightning-bolt" class="me-2" color="primary" />
          Quick Actions
        </h3>
        <v-row>
          <v-col v-for="action in quickActions" :key="action.title" cols="12" md="6">
            <v-card class="action-card h-100" elevation="1" @click="navigateTo(action.path)">
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-3">
                  <v-icon :icon="action.icon" color="primary" class="me-3" />
                  <h4 class="text-h6 font-weight-medium">{{ action.title }}</h4>
                </div>
                <p class="text-body-2 text-medium-emphasis mb-3">{{ action.description }}</p>
                <v-chip size="small" :color="action.color" variant="outlined">
                  {{ action.category }}
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Next Steps -->
    <v-card class="next-steps-card" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-map" class="me-2" color="primary" />
          What's Next?
        </h3>
        <v-list>
          <v-list-item
            v-for="nextStep in nextSteps"
            :key="nextStep.title"
            class="next-step-item"
            @click="navigateTo(nextStep.path)"
          >
            <template #prepend>
              <v-icon :icon="nextStep.icon" color="primary" />
            </template>
            <v-list-item-title class="font-weight-medium">{{ nextStep.title }}</v-list-item-title>
            <v-list-item-subtitle>{{ nextStep.description }}</v-list-item-subtitle>
            <template #append>
              <v-icon icon="mdi-arrow-right" />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Getting Started - Documentation',
  description: 'Quick start guide for the Cloudless.gr ML platform',
  layout: 'documentation',
});

const currentStep = ref(1);

const steps = [
  { title: 'Account', value: 1 },
  { title: 'Template', value: 2 },
  { title: 'Project', value: 3 },
  { title: 'Deploy', value: 4 },
];

const keyFeatures = [
  {
    title: 'Visual Pipeline Builder',
    description: 'Drag-and-drop interface for building ML pipelines without coding',
    icon: 'mdi-pipe',
  },
  {
    title: 'Pre-built Templates',
    description: 'Ready-to-use templates for common ML use cases and algorithms',
    icon: 'mdi-folder-multiple',
  },
  {
    title: 'One-Click Deployment',
    description: 'Deploy trained models to production with a single click',
    icon: 'mdi-cloud-upload',
  },
  {
    title: 'Real-time Monitoring',
    description: 'Monitor model performance and health in real-time dashboards',
    icon: 'mdi-chart-line',
  },
  {
    title: 'Auto-scaling',
    description: 'Automatically scale your deployments based on demand',
    icon: 'mdi-trending-up',
  },
  {
    title: 'Version Control',
    description: 'Track and manage different versions of your models and experiments',
    icon: 'mdi-source-branch',
  },
];

const quickActions = [
  {
    title: 'Create Your First Project',
    description: 'Start building with our step-by-step project creation wizard',
    icon: 'mdi-plus-circle',
    path: '/projects/create',
    category: 'Start Here',
    color: 'success',
  },
  {
    title: 'Explore Templates',
    description: 'Browse our collection of ML project templates',
    icon: 'mdi-view-grid',
    path: '/projects/templates',
    category: 'Templates',
    color: 'primary',
  },
  {
    title: 'View Examples',
    description: 'Learn from real-world examples and use cases',
    icon: 'mdi-lightbulb',
    path: '/documentation/examples',
    category: 'Learn',
    color: 'warning',
  },
  {
    title: 'API Documentation',
    description: 'Integrate with our REST API for advanced use cases',
    icon: 'mdi-api',
    path: '/documentation/api-reference',
    category: 'Advanced',
    color: 'info',
  },
];

const nextSteps = [
  {
    title: 'Project Management Guide',
    description: 'Learn how to organize and manage your ML projects effectively',
    icon: 'mdi-folder-cog',
    path: '/documentation/project-management',
  },
  {
    title: 'Model Training Tutorial',
    description: 'Deep dive into training, tuning, and optimizing your models',
    icon: 'mdi-brain',
    path: '/documentation/model-training',
  },
  {
    title: 'Deployment Best Practices',
    description: 'Learn how to deploy models to production safely and efficiently',
    icon: 'mdi-cloud-upload',
    path: '/documentation/deployment',
  },
  {
    title: 'API Integration',
    description: 'Integrate the platform with your existing systems using our API',
    icon: 'mdi-api',
    path: '/documentation/api/authentication',
  },
];
</script>

<style scoped>
.getting-started-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: white;
}

.page-header {
  margin-bottom: 32px;
}

.header-content {
  text-align: center;
  margin-top: 16px;
}

.progress-card,
.features-card,
.quick-actions-card,
.next-steps-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.custom-stepper {
  background: transparent;
}

.step-content {
  padding: 16px;
}

.feature-item {
  text-align: center;
  padding: 16px;
}

.action-card {
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.action-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.next-step-item {
  cursor: pointer;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.next-step-item:hover {
  background: rgba(var(--v-theme-primary), 0.1);
}

@media (max-width: 768px) {
  .getting-started-page {
    padding: 16px;
  }

  .feature-item {
    text-align: left;
    padding: 8px;
  }
}
</style>
