<template>
  <div class="documentation-page">
    <div class="page-header">
      <h1>
        <v-icon size="32" class="mr-3">
          mdi-book-open-variant
        </v-icon>
        Documentation
      </h1>
      <p class="subtitle">
        Complete guide to building AI-driven cloud solutions with Cloudless Wizard
      </p>
    </div>

    <div class="content-container">
      <div class="documentation-content">
        <div class="doc-layout">
          <div class="doc-sidebar">
            <div class="sidebar-card">
              <h3 class="sidebar-title">
                <v-icon class="mr-2">
                  mdi-menu
                </v-icon>
                Documentation
              </h3>
              <div class="sidebar-nav">
                <div
                  v-for="section in docSections"
                  :key="section.path"
                  class="nav-item"
                  :class="{ active: $route.path === section.path }"
                >
                  <NuxtLink :to="section.path" class="nav-link">
                    <v-icon size="20" class="nav-icon">
                      {{ section.icon }}
                    </v-icon>
                    <div class="nav-content">
                      <span class="nav-title">{{ section.title }}</span>
                      <span class="nav-subtitle">{{ section.subtitle }}</span>
                    </div>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>

          <div class="doc-main">
            <div class="main-content">
              <h2>Welcome to Cloudless Wizard</h2>
              <p class="welcome-text">
                Cloudless Wizard is a comprehensive platform for building AI-driven cloud solutions. 
                This documentation will guide you through all the features and capabilities of the platform.
              </p>

              <div class="info-alert">
                <v-icon size="24" color="info">
                  mdi-lightbulb
                </v-icon>
                <div class="alert-content">
                  <strong>Quick Start:</strong> If you're new to Cloudless Wizard, we recommend starting with the 
                  <NuxtLink to="/documentation/getting-started" class="text-link">
                    Getting Started
                  </NuxtLink> guide.
                </div>
              </div>

              <div class="features-section">
                <h3>Platform Features</h3>
                <div class="features-grid">
                  <div
                    v-for="feature in mainFeatures"
                    :key="feature.title"
                    class="feature-card"
                  >
                    <div class="feature-header">
                      <v-icon size="24" color="primary">
                        {{ feature.icon }}
                      </v-icon>
                      <h4>{{ feature.title }}</h4>
                    </div>
                    <p>{{ feature.description }}</p>
                    <NuxtLink :to="feature.link" class="feature-link">
                      Learn More
                      <v-icon size="16">
                        mdi-arrow-right
                      </v-icon>
                    </NuxtLink>
                  </div>
                </div>
              </div>

              <div class="quick-links-section">
                <h3>Quick Links</h3>
                <div class="quick-links-grid">
                  <NuxtLink
                    v-for="link in quickLinks"
                    :key="link.title"
                    :to="link.path"
                    class="quick-link-card"
                  >
                    <v-icon size="24" color="primary">
                      {{ link.icon }}
                    </v-icon>
                    <span>{{ link.title }}</span>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
.documentation-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9) !important;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.9) !important;
  margin: 0;
}

.content-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.documentation-content {
  max-width: 1000px;
  margin: 0 auto;
}

.doc-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 3rem;
}

.doc-sidebar {
  position: sticky;
  top: 2rem;
  height: fit-content;
}

.sidebar-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.sidebar-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-item:hover,
.nav-item.active {
  background: rgba(102, 126, 234, 0.1);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
}

.nav-icon {
  color: #667eea;
  flex-shrink: 0;
}

.nav-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-title {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
}

.nav-subtitle {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
}

.doc-main {
  min-height: 600px;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.main-content h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.welcome-text {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.info-alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
}

.alert-content {
  color: rgba(0, 0, 0, 0.8);
  line-height: 1.6;
}

.text-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.text-link:hover {
  text-decoration: underline;
}

.features-section h3,
.quick-links-section h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0 0 1.5rem 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.feature-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.feature-header h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.feature-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.feature-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
}

.feature-link:hover {
  text-decoration: underline;
}

.quick-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.quick-link-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1rem;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.8);
  transition: all 0.3s ease;
}

.quick-link-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  background: rgba(102, 126, 234, 0.05);
}

@media (max-width: 1024px) {
  .doc-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .doc-sidebar {
    position: static;
  }
}

@media (max-width: 768px) {
  .documentation-page {
    padding: 1rem;
  }

  .content-container {
    padding: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .quick-links-grid {
    grid-template-columns: 1fr;
  }
}
</style> 