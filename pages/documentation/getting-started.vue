<template>
  <div class="documentation-container">
    <v-container max-width="1200">
      <v-row>
        <v-col cols="12">
          <div class="doc-header">
            <h1 class="doc-title">
              <v-icon size="32" class="mr-3">
                mdi-rocket-launch
              </v-icon>
              Getting Started
            </h1>
            <p class="doc-subtitle">
              Quick setup guide to get you started with Cloudless Wizard
            </p>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="9" class="mx-auto">
          <v-card class="doc-content-card">
            <v-card-text>
              <h2 class="text-h4 mb-4">
                <v-icon class="mr-2">
                  mdi-information
                </v-icon>
                Overview
              </h2>
              <p class="text-body-1 mb-4">
                Cloudless Wizard is a comprehensive platform for building AI-driven cloud solutions. 
                Whether you're creating chatbots, training custom models, or building data pipelines, 
                Cloudless Wizard provides the tools you need to bring your AI ideas to life.
              </p>
              
              <v-alert
                type="success"
                variant="tonal"
                class="mb-6"
              >
                <template #prepend>
                  <v-icon>mdi-check-circle</v-icon>
                </template>
                <strong>What you'll learn:</strong> This guide will walk you through creating your first project, 
                building a simple bot, and deploying it to the cloud.
              </v-alert>

              <h2 class="text-h4 mb-4">
                <v-icon class="mr-2">
                  mdi-lightning-bolt
                </v-icon>
                Quick Start (5 minutes)
              </h2>
              
              <v-timeline density="compact" class="mb-6">
                <v-timeline-item
                  v-for="(step, index) in quickStartSteps"
                  :key="step.title"
                  :dot-color="step.color"
                  size="small"
                >
                  <template #opposite>
                    <div class="text-caption">
                      {{ index + 1 }}
                    </div>
                  </template>
                  <v-card>
                    <v-card-title class="text-h6">
                      {{ step.title }}
                    </v-card-title>
                    <v-card-text>
                      <p class="text-body-2">
                        {{ step.description }}
                      </p>
                      <v-btn
                        v-if="step.action"
                        :to="step.action.path"
                        :color="step.action.color"
                        variant="elevated"
                        size="small"
                        class="mt-2"
                      >
                        <v-icon start>
                          {{ step.action.icon }}
                        </v-icon>
                        {{ step.action.text }}
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-timeline-item>
              </v-timeline>

              <h2 class="text-h4 mb-4">
                <v-icon class="mr-2">
                  mdi-arrow-right
                </v-icon>
                Next Steps
              </h2>
              <p class="text-body-1 mb-4">
                Now that you've completed the quick start, here are some suggested next steps:
              </p>
              
              <v-row>
                <v-col
                  v-for="nextStep in nextSteps"
                  :key="nextStep.title"
                  cols="12"
                  sm="6"
                  lg="4"
                >
                  <v-card class="next-step-card h-100" elevation="2">
                    <v-card-title class="text-h6 d-flex align-center">
                      <v-icon :icon="nextStep.icon" class="mr-2" color="primary" />
                      {{ nextStep.title }}
                    </v-card-title>
                    <v-card-text>
                      <p class="text-body-2 mb-3">
                        {{ nextStep.description }}
                      </p>
                      <v-btn
                        :to="nextStep.link"
                        variant="text"
                        color="primary"
                        size="small"
                      >
                        Learn More
                        <v-icon end>
                          mdi-arrow-right
                        </v-icon>
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
const quickStartSteps = [
  {
    title: 'Create Your First Project',
    description: 'Start by creating a new project to organize your work.',
    color: 'primary',
    action: {
      text: 'Create Project',
      path: '/projects/create',
      icon: 'mdi-plus-box',
      color: 'primary'
    }
  },
  {
    title: 'Build Your First Bot',
    description: 'Create an AI-powered chatbot using our visual builder.',
    color: 'secondary',
    action: {
      text: 'Build Bot',
      path: '/bots',
      icon: 'mdi-robot',
      color: 'secondary'
    }
  },
  {
    title: 'Train a Custom Model',
    description: 'Train an AI model with your own data for specialized tasks.',
    color: 'success',
    action: {
      text: 'Train Model',
      path: '/models/train',
      icon: 'mdi-brain',
      color: 'success'
    }
  },
  {
    title: 'Deploy Your Solution',
    description: 'Deploy your AI solution to the cloud with one click.',
    color: 'info',
    action: {
      text: 'Deploy',
      path: '/deploy',
      icon: 'mdi-cloud-upload',
      color: 'info'
    }
  }
]

const nextSteps = [
  {
    title: 'Bot Builder Guide',
    description: 'Learn how to create sophisticated chatbots with advanced features.',
    icon: 'mdi-robot',
    link: '/documentation/bots'
  },
  {
    title: 'Model Training',
    description: 'Master the art of training custom AI models for your specific needs.',
    icon: 'mdi-brain',
    link: '/documentation/models'
  },
  {
    title: 'Pipeline Creator',
    description: 'Build complex data processing pipelines with our visual editor.',
    icon: 'mdi-timeline',
    link: '/documentation/pipelines'
  }
]
</script>

<style scoped>
.documentation-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 2rem 0;
}

.doc-header {
  text-align: center;
  margin-bottom: 3rem;
}

.doc-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-subtitle {
  font-size: 1.2rem;
  color: #666;
  max-width: 600px;
  margin: 0 auto;
}

.doc-content-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  min-height: 600px;
}

.next-step-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.next-step-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .doc-title {
    font-size: 2rem;
  }
  
  .doc-subtitle {
    font-size: 1rem;
  }
  
  .documentation-container {
    padding: 1rem 0;
  }
}
</style> 