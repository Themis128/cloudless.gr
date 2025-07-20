<template>
  <div class="getting-started-page">
    <div class="page-header">
      <h1>
        <v-icon size="32" class="mr-3">
          mdi-rocket-launch
        </v-icon>
        Getting Started
      </h1>
      <p class="subtitle">
        Quick setup guide to get you started with Cloudless Wizard
      </p>
    </div>

    <div class="content-container">
      <div class="getting-started-content">
        <div class="overview-section">
          <h2>
            <v-icon class="mr-2">
              mdi-information
            </v-icon>
            Overview
          </h2>
          <p class="overview-text">
            Cloudless Wizard is a comprehensive platform for building AI-driven cloud solutions. 
            Whether you're creating chatbots, training custom models, or building data pipelines, 
            Cloudless Wizard provides the tools you need to bring your AI ideas to life.
          </p>
          
          <div class="success-alert">
            <v-icon size="24" color="success">
              mdi-check-circle
            </v-icon>
            <div class="alert-content">
              <strong>What you'll learn:</strong> This guide will walk you through creating your first project, 
              building a simple bot, and deploying it to the cloud.
            </div>
          </div>
        </div>

        <div class="quick-start-section">
          <h2>
            <v-icon class="mr-2">
              mdi-lightning-bolt
            </v-icon>
            Quick Start (5 minutes)
          </h2>
          
          <div class="steps-timeline">
            <div
              v-for="(step, index) in quickStartSteps"
              :key="step.title"
              class="step-item"
            >
              <div class="step-number">
                {{ index + 1 }}
              </div>
              <div class="step-content">
                <div class="step-header">
                  <h3>{{ step.title }}</h3>
                  <div class="step-color" :style="{ backgroundColor: getStepColor(step.color) }" />
                </div>
                <p>{{ step.description }}</p>
                <NuxtLink
                  v-if="step.action"
                  :to="step.action.path"
                  class="step-action-btn"
                  :style="{ backgroundColor: getStepColor(step.action.color) }"
                >
                  <v-icon size="16">
                    {{ step.action.icon }}
                  </v-icon>
                  {{ step.action.text }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <div class="next-steps-section">
          <h2>
            <v-icon class="mr-2">
              mdi-arrow-right
            </v-icon>
            Next Steps
          </h2>
          <p class="next-steps-intro">
            Now that you've completed the quick start, here are some suggested next steps:
          </p>
          
          <div class="next-steps-grid">
            <div
              v-for="nextStep in nextSteps"
              :key="nextStep.title"
              class="next-step-card"
            >
              <div class="next-step-header">
                <v-icon size="24" color="primary">
                  {{ nextStep.icon }}
                </v-icon>
                <h3>{{ nextStep.title }}</h3>
              </div>
              <p>{{ nextStep.description }}</p>
              <NuxtLink :to="nextStep.link" class="next-step-link">
                Learn More
                <v-icon size="16">
                  mdi-arrow-right
                </v-icon>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
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
    description: 'Build complex data processing pipelines with our visual builder.',
    icon: 'mdi-timeline',
    link: '/documentation/pipelines'
  },
  {
    title: 'Deployment Guide',
    description: 'Learn how to deploy your AI solutions to production.',
    icon: 'mdi-cloud-upload',
    link: '/documentation/deployment'
  },
  {
    title: 'API Reference',
    description: 'Explore our comprehensive API documentation.',
    icon: 'mdi-code-braces',
    link: '/documentation/api'
  },
  {
    title: 'Troubleshooting',
    description: 'Find solutions to common issues and get help when you need it.',
    icon: 'mdi-help-circle',
    link: '/documentation/troubleshooting'
  }
]

const getStepColor = (color: string) => {
  const colors: Record<string, string> = {
    primary: '#667eea',
    secondary: '#764ba2',
    success: '#4caf50',
    info: '#2196f3',
    warning: '#ff9800',
    error: '#f44336'
  }
  return colors[color] || colors.primary
}
</script>

<style scoped>
.getting-started-page {
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(0, 0, 0, 0.7);
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

.getting-started-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.overview-section,
.quick-start-section,
.next-steps-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.overview-section h2,
.quick-start-section h2,
.next-steps-section h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
}

.overview-text {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.success-alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
}

.alert-content {
  color: rgba(0, 0, 0, 0.8);
  line-height: 1.6;
}

.steps-timeline {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.step-item {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.step-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.step-content:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.step-header h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.step-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.step-content p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.step-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9rem;
  transition: opacity 0.3s ease;
}

.step-action-btn:hover {
  opacity: 0.9;
}

.next-steps-intro {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.next-steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.next-step-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.next-step-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.next-step-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.next-step-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.next-step-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.next-step-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
}

.next-step-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .getting-started-page {
    padding: 1rem;
  }

  .content-container {
    padding: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .step-item {
    flex-direction: column;
    gap: 1rem;
  }

  .next-steps-grid {
    grid-template-columns: 1fr;
  }
}
</style> 