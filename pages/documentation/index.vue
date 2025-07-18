<template>
  <div class="documentation-container">
    <v-container max-width="1200">
      <v-row>
        <v-col cols="12">
          <div class="doc-header">
            <h1 class="doc-title">
              <v-icon size="32" class="mr-3">
                mdi-book-open-variant
              </v-icon>
              Cloudless Wizard Documentation
            </h1>
            <p class="doc-subtitle">
              Complete guide to building AI-driven cloud solutions with Cloudless Wizard
            </p>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="3">
          <v-card class="doc-nav-card">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">
                mdi-menu
              </v-icon>
              Documentation
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list density="compact">
                <v-list-item
                  v-for="section in docSections"
                  :key="section.path"
                  :to="section.path"
                  :prepend-icon="section.icon"
                  :title="section.title"
                  :subtitle="section.subtitle"
                  class="doc-nav-item"
                />
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="9">
          <v-card class="doc-content-card">
            <v-card-title class="text-h5">
              Welcome to Cloudless Wizard
            </v-card-title>
            <v-card-text>
              <p class="text-body-1 mb-4">
                Cloudless Wizard is a comprehensive platform for building AI-driven cloud solutions. 
                This documentation will guide you through all the features and capabilities of the platform.
              </p>

              <v-alert
                type="info"
                variant="tonal"
                class="mb-6"
              >
                <template #prepend>
                  <v-icon>mdi-lightbulb</v-icon>
                </template>
                <strong>Quick Start:</strong> If you're new to Cloudless Wizard, we recommend starting with the 
                <NuxtLink to="/documentation/getting-started" class="text-decoration-none">
                  Getting Started
                </NuxtLink> guide.
              </v-alert>

              <div class="feature-grid">
                <v-row>
                  <v-col
                    v-for="feature in mainFeatures"
                    :key="feature.title"
                    cols="12"
                    sm="6"
                    lg="4"
                  >
                    <v-card class="feature-card h-100" elevation="2">
                      <v-card-title class="text-h6 d-flex align-center">
                        <v-icon :icon="feature.icon" class="mr-2" color="primary" />
                        {{ feature.title }}
                      </v-card-title>
                      <v-card-text>
                        <p class="text-body-2">
                          {{ feature.description }}
                        </p>
                        <v-btn
                          :to="feature.link"
                          variant="text"
                          color="primary"
                          size="small"
                          class="mt-2"
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
              </div>

              <v-divider class="my-6" />

              <div class="quick-links">
                <h3 class="text-h6 mb-4">
                  Quick Links
                </h3>
                <v-row>
                  <v-col
                    v-for="link in quickLinks"
                    :key="link.title"
                    cols="12"
                    sm="6"
                    md="4"
                  >
                    <v-btn
                      :to="link.path"
                      variant="outlined"
                      block
                      class="quick-link-btn"
                    >
                      <v-icon start>
                        {{ link.icon }}
                      </v-icon>
                      {{ link.title }}
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Documentation page component

const docSections = [
  {
    title: 'Getting Started',
    subtitle: 'Quick setup and first steps',
    path: '/documentation/getting-started',
    icon: 'mdi-rocket-launch'
  },
  {
    title: 'Projects',
    subtitle: 'Manage your projects',
    path: '/documentation/projects',
    icon: 'mdi-folder-multiple'
  },
  {
    title: 'Bot Builder',
    subtitle: 'Create AI-powered bots',
    path: '/documentation/bots',
    icon: 'mdi-robot'
  },
  {
    title: 'Model Training',
    subtitle: 'Train custom AI models',
    path: '/documentation/models',
    icon: 'mdi-brain'
  },
  {
    title: 'Pipelines',
    subtitle: 'Build data processing pipelines',
    path: '/documentation/pipelines',
    icon: 'mdi-timeline'
  },
  {
    title: 'LLM Management',
    subtitle: 'Manage language models',
    path: '/documentation/llm',
    icon: 'mdi-chat-processing'
  },
  {
    title: 'Deployment',
    subtitle: 'Deploy your solutions',
    path: '/documentation/deployment',
    icon: 'mdi-cloud-upload'
  },
  {
    title: 'Debug Tools',
    subtitle: 'Debug and troubleshoot',
    path: '/documentation/debug',
    icon: 'mdi-bug'
  },
  {
    title: 'API Reference',
    subtitle: 'Technical API documentation',
    path: '/documentation/api',
    icon: 'mdi-code-braces'
  },
  {
    title: 'Troubleshooting',
    subtitle: 'Common issues and solutions',
    path: '/documentation/troubleshooting',
    icon: 'mdi-help-circle'
  }
]

const mainFeatures = [
  {
    title: 'Bot Builder',
    description: 'Create intelligent chatbots and AI assistants with our visual builder.',
    icon: 'mdi-robot',
    link: '/documentation/bots'
  },
  {
    title: 'Model Training',
    description: 'Train custom AI models with your data for specialized tasks.',
    icon: 'mdi-brain',
    link: '/documentation/models'
  },
  {
    title: 'Pipeline Creator',
    description: 'Build complex data processing pipelines with drag-and-drop interface.',
    icon: 'mdi-timeline',
    link: '/documentation/pipelines'
  },
  {
    title: 'LLM Management',
    description: 'Manage and integrate various language models into your applications.',
    icon: 'mdi-chat-processing',
    link: '/documentation/llm'
  },
  {
    title: 'Deployment',
    description: 'Deploy your AI solutions to the cloud with one-click deployment.',
    icon: 'mdi-cloud-upload',
    link: '/documentation/deployment'
  },
  {
    title: 'Debug Tools',
    description: 'Comprehensive debugging and monitoring tools for your AI applications.',
    icon: 'mdi-bug',
    link: '/documentation/debug'
  }
]

const quickLinks = [
  {
    title: 'Create Your First Bot',
    path: '/documentation/bots/quick-start',
    icon: 'mdi-robot'
  },
  {
    title: 'Train a Model',
    path: '/documentation/models/quick-start',
    icon: 'mdi-brain'
  },
  {
    title: 'Build a Pipeline',
    path: '/documentation/pipelines/quick-start',
    icon: 'mdi-timeline'
  },
  {
    title: 'Deploy to Cloud',
    path: '/documentation/deployment/quick-start',
    icon: 'mdi-cloud-upload'
  },
  {
    title: 'API Reference',
    path: '/documentation/api',
    icon: 'mdi-code-braces'
  },
  {
    title: 'Get Help',
    path: '/documentation/troubleshooting',
    icon: 'mdi-help-circle'
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

.doc-nav-card {
  position: sticky;
  top: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.doc-nav-item {
  border-radius: 8px;
  margin: 2px 8px;
  transition: all 0.2s ease;
}

.doc-nav-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.doc-content-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  min-height: 600px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.quick-link-btn {
  height: 48px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.quick-link-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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