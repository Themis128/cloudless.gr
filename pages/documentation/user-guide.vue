<template>
  <div class="user-guide-page">
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
          <v-icon icon="mdi-account-group" class="me-3" color="primary" />
          User Guide
        </h1>
        <p class="text-h6 text-medium-emphasis">
          Complete guide to using the Cloudless.gr platform
        </p>
      </div>
    </div>

    <!-- Navigation -->
    <v-card class="nav-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">Quick Navigation</h3>
        <v-row>
          <v-col v-for="navItem in navigationItems" :key="navItem.id" cols="12" md="6" lg="3">
            <v-btn block variant="outlined" class="h-100 pa-4" @click="scrollToSection(navItem.id)">
              <div class="text-center">
                <v-icon :icon="navItem.icon" size="large" class="mb-2" />
                <div class="text-body-1 font-weight-medium">{{ navItem.title }}</div>
              </div>
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Account Setup -->
    <div id="account-setup" class="guide-section mb-8">
      <v-card elevation="2">
        <v-card-text class="pa-6">
          <h2 class="text-h4 font-weight-bold mb-4">
            <v-icon icon="mdi-account-plus" class="me-3" color="primary" />
            Account Setup
          </h2>

          <div class="steps-container">
            <div v-for="(step, index) in accountSetupSteps" :key="index" class="step-item mb-6">
              <div class="step-header mb-3">
                <v-chip color="primary" class="me-3">{{ index + 1 }}</v-chip>
                <h3 class="text-h6 font-weight-bold">{{ step.title }}</h3>
              </div>
              <p class="text-body-1 mb-3">{{ step.description }}</p>

              <v-expansion-panels v-if="step.details" class="step-details">
                <v-expansion-panel title="Show Details">
                  <v-expansion-panel-text>
                    <div v-html="step.details" />
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-btn v-if="step.action" :to="step.action.link" color="primary" class="mt-3">
                {{ step.action.text }}
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Creating Projects -->
    <div id="creating-projects" class="guide-section mb-8">
      <v-card elevation="2">
        <v-card-text class="pa-6">
          <h2 class="text-h4 font-weight-bold mb-4">
            <v-icon icon="mdi-folder-plus" class="me-3" color="primary" />
            Creating Projects
          </h2>

          <div class="content-section">
            <p class="text-body-1 mb-4">
              Projects are the core of the Cloudless.gr platform. Each project represents a machine
              learning workflow from data preparation to model deployment.
            </p>

            <v-tabs v-model="projectTab" class="mb-4">
              <v-tab value="web">Web Interface</v-tab>
              <v-tab value="api">API</v-tab>
              <v-tab value="cli">CLI</v-tab>
            </v-tabs>

            <v-tabs-window v-model="projectTab">
              <v-tabs-window-item value="web">
                <div class="tab-content">
                  <h4 class="text-h6 font-weight-bold mb-3">Using the Web Interface</h4>
                  <ol class="project-steps">
                    <li class="mb-3">
                      <strong>Navigate to Projects:</strong> Click on "Projects" in the main
                      navigation
                    </li>
                    <li class="mb-3">
                      <strong>Create New Project:</strong> Click the "+" button or "Create Project"
                    </li>
                    <li class="mb-3">
                      <strong>Choose Template:</strong> Select from our pre-built templates or start
                      from scratch
                    </li>
                    <li class="mb-3">
                      <strong>Configure Settings:</strong> Set project name, description, and
                      initial parameters
                    </li>
                    <li class="mb-3">
                      <strong>Launch:</strong> Your project environment will be ready in seconds
                    </li>
                  </ol>

                  <v-btn color="primary" to="/projects/create" class="mt-3">
                    Create Your First Project
                  </v-btn>
                </div>
              </v-tabs-window-item>

              <v-tabs-window-item value="api">
                <div class="tab-content">
                  <h4 class="text-h6 font-weight-bold mb-3">Using the API</h4>
                  <p class="text-body-2 mb-3">
                    Create projects programmatically using our REST API:
                  </p>
                  <v-code class="api-code d-block mb-4">
                    curl -X POST https://api.cloudless.gr/v1/projects \ -H "Authorization: Bearer
                    your-api-token" \ -H "Content-Type: application/json" \ -d '{ "name": "My ML
                    Project", "description": "Computer vision model for image classification",
                    "type": "cv", "framework": "tensorflow", "template": "image-classification" }'
                  </v-code>
                  <v-btn color="primary" to="/documentation/api-reference" variant="outlined">
                    View API Documentation
                  </v-btn>
                </div>
              </v-tabs-window-item>

              <v-tabs-window-item value="cli">
                <div class="tab-content">
                  <h4 class="text-h6 font-weight-bold mb-3">Using the CLI</h4>
                  <p class="text-body-2 mb-3">
                    Use our command-line interface for quick project creation:
                  </p>
                  <v-code class="api-code d-block mb-4">
                    # Install the CLI npm install -g @cloudless/cli # Login cloudless auth login #
                    Create a new project cloudless projects create \ --name "My ML Project" \ --type
                    cv \ --template image-classification
                  </v-code>
                </div>
              </v-tabs-window-item>
            </v-tabs-window>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Training Models -->
    <div id="training-models" class="guide-section mb-8">
      <v-card elevation="2">
        <v-card-text class="pa-6">
          <h2 class="text-h4 font-weight-bold mb-4">
            <v-icon icon="mdi-brain" class="me-3" color="primary" />
            Training Models
          </h2>

          <div class="training-workflow">
            <v-stepper v-model="trainingStep" class="training-stepper">
              <v-stepper-header>
                <v-stepper-item
                  v-for="(step, index) in trainingSteps"
                  :key="index"
                  :value="index + 1"
                  :title="step.title"
                  :subtitle="step.subtitle"
                />
              </v-stepper-header>

              <v-stepper-window>
                <v-stepper-window-item
                  v-for="(step, index) in trainingSteps"
                  :key="index"
                  :value="index + 1"
                >
                  <div class="step-content pa-4">
                    <h4 class="text-h6 font-weight-bold mb-3">{{ step.title }}</h4>
                    <p class="text-body-1 mb-4">{{ step.description }}</p>

                    <div v-if="step.code" class="mb-4">
                      <v-code class="api-code d-block">{{ step.code }}</v-code>
                    </div>

                    <v-alert v-if="step.tip" type="info" class="mb-4">
                      <strong>Tip:</strong> {{ step.tip }}
                    </v-alert>

                    <div class="step-actions">
                      <v-btn
                        v-if="index > 0"
                        variant="outlined"
                        class="me-2"
                        @click="trainingStep = index"
                      >
                        Previous
                      </v-btn>
                      <v-btn
                        v-if="index < trainingSteps.length - 1"
                        color="primary"
                        @click="trainingStep = index + 2"
                      >
                        Next
                      </v-btn>
                    </div>
                  </div>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Deployment -->
    <div id="deployment" class="guide-section mb-8">
      <v-card elevation="2">
        <v-card-text class="pa-6">
          <h2 class="text-h4 font-weight-bold mb-4">
            <v-icon icon="mdi-cloud-upload" class="me-3" color="primary" />
            Deployment
          </h2>

          <div class="deployment-options">
            <v-row>
              <v-col v-for="option in deploymentOptions" :key="option.title" cols="12" md="4">
                <v-card class="deployment-card h-100" elevation="1">
                  <v-card-text class="pa-4">
                    <div class="text-center mb-3">
                      <v-icon :icon="option.icon" size="48" color="primary" />
                    </div>
                    <h4 class="text-h6 font-weight-bold text-center mb-2">{{ option.title }}</h4>
                    <p class="text-body-2 text-medium-emphasis mb-3">{{ option.description }}</p>

                    <v-list density="compact" class="feature-list">
                      <v-list-item v-for="feature in option.features" :key="feature">
                        <template #prepend>
                          <v-icon icon="mdi-check" size="small" color="success" />
                        </template>
                        <v-list-item-title class="text-body-2">{{ feature }}</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Best Practices -->
    <div id="best-practices" class="guide-section">
      <v-card elevation="2">
        <v-card-text class="pa-6">
          <h2 class="text-h4 font-weight-bold mb-4">
            <v-icon icon="mdi-star" class="me-3" color="primary" />
            Best Practices
          </h2>

          <div class="best-practices-grid">
            <div
              v-for="practice in bestPractices"
              :key="practice.category"
              class="practice-category mb-6"
            >
              <h3 class="text-h5 font-weight-bold mb-3">
                <v-icon :icon="practice.icon" class="me-2" color="primary" />
                {{ practice.category }}
              </h3>

              <v-list class="practice-list">
                <v-list-item v-for="item in practice.items" :key="item.title">
                  <template #prepend>
                    <v-icon icon="mdi-lightbulb" size="small" color="warning" />
                  </template>
                  <v-list-item-title class="font-weight-medium">{{ item.title }}</v-list-item-title>
                  <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'User Guide - Documentation',
  description: 'Complete guide to using the Cloudless.gr platform',
  layout: 'documentation',
});

const projectTab = ref('web');
const trainingStep = ref(1);

const navigationItems = [
  { id: 'account-setup', title: 'Account Setup', icon: 'mdi-account-plus' },
  { id: 'creating-projects', title: 'Creating Projects', icon: 'mdi-folder-plus' },
  { id: 'training-models', title: 'Training Models', icon: 'mdi-brain' },
  { id: 'deployment', title: 'Deployment', icon: 'mdi-cloud-upload' },
];

const accountSetupSteps = [
  {
    title: 'Create Your Account',
    description: 'Sign up for a free Cloudless.gr account to get started.',
    details: `
      <p>Visit our registration page and provide:</p>
      <ul>
        <li>Email address</li>
        <li>Strong password</li>
        <li>Organization name (optional)</li>
      </ul>
      <p>You'll receive an email verification link within minutes.</p>
    `,
    action: { text: 'Sign Up Now', link: '/auth/register' },
  },
  {
    title: 'Verify Your Email',
    description: 'Check your inbox and click the verification link to activate your account.',
    details: `
      <p>Don't see the email? Check your spam folder or:</p>
      <ul>
        <li>Wait a few minutes and check again</li>
        <li>Request a new verification email</li>
        <li>Contact support if issues persist</li>
      </ul>
    `,
  },
  {
    title: 'Complete Your Profile',
    description: 'Add additional information to personalize your experience.',
    details: `
      <p>Enhance your profile with:</p>
      <ul>
        <li>Profile picture</li>
        <li>Job title and company</li>
        <li>Areas of interest</li>
        <li>Notification preferences</li>
      </ul>
    `,
    action: { text: 'Edit Profile', link: '/profile' },
  },
  {
    title: 'Choose Your Plan',
    description: 'Select a plan that fits your needs, or continue with the free tier.',
    details: `
      <p>Available plans:</p>
      <ul>
        <li><strong>Free:</strong> 10 hours compute, 1GB storage</li>
        <li><strong>Pro:</strong> 100 hours compute, 10GB storage</li>
        <li><strong>Team:</strong> Unlimited compute, collaborative features</li>
      </ul>
    `,
    action: { text: 'View Plans', link: '/pricing' },
  },
];

const trainingSteps = [
  {
    title: 'Data Preparation',
    subtitle: 'Upload and organize your dataset',
    description:
      'Start by uploading your training data. Cloudless.gr supports various formats including images, CSV files, and custom datasets.',
    code: `# Upload data via CLI
cloudless data upload ./my-dataset/ --project my-project

# Or use the Python SDK
from cloudless import Client
client = Client(api_key="your-key")
client.data.upload("./my-dataset/", project_id="proj_123")`,
    tip: 'Organize your data in clear folder structures for better organization and faster processing.',
  },
  {
    title: 'Model Configuration',
    subtitle: 'Set up your training parameters',
    description:
      'Configure your model architecture, hyperparameters, and training settings through our intuitive interface or configuration files.',
    code: `# Example training configuration
{
  "model": {
    "type": "cnn",
    "layers": [
      {"type": "conv2d", "filters": 32, "kernel_size": 3},
      {"type": "maxpool2d", "pool_size": 2},
      {"type": "dense", "units": 128},
      {"type": "dense", "units": 10, "activation": "softmax"}
    ]
  },
  "training": {
    "epochs": 50,
    "batch_size": 32,
    "learning_rate": 0.001
  }
}`,
    tip: 'Start with our pre-configured templates and adjust parameters based on your specific needs.',
  },
  {
    title: 'Start Training',
    subtitle: 'Launch your training job',
    description:
      'Once configured, start your training job. Monitor progress in real-time through our dashboard or receive notifications.',
    code: `# Start training via API
curl -X POST https://api.cloudless.gr/v1/projects/proj_123/training \\
  -H "Authorization: Bearer your-token" \\
  -d @training-config.json`,
    tip: 'Use our experiment tracking to compare different training runs and optimize your models.',
  },
  {
    title: 'Monitor & Evaluate',
    subtitle: 'Track training progress and results',
    description:
      'Monitor training metrics in real-time, visualize model performance, and compare different experiments.',
    tip: 'Set up alerts to notify you when training completes or if issues arise during the process.',
  },
];

const deploymentOptions = [
  {
    title: 'REST API',
    description: 'Deploy your model as a REST API endpoint for easy integration',
    icon: 'mdi-api',
    features: [
      'Auto-scaling',
      'Load balancing',
      'Custom domains',
      'API key management',
      'Rate limiting',
    ],
  },
  {
    title: 'Batch Processing',
    description: 'Process large datasets efficiently with batch inference',
    icon: 'mdi-database',
    features: [
      'Scheduled jobs',
      'Large file support',
      'Progress tracking',
      'Error handling',
      'Result storage',
    ],
  },
  {
    title: 'Edge Deployment',
    description: 'Deploy lightweight models for edge computing scenarios',
    icon: 'mdi-cellphone',
    features: [
      'Model optimization',
      'Mobile support',
      'Offline capability',
      'Low latency',
      'Reduced bandwidth',
    ],
  },
];

const bestPractices = [
  {
    category: 'Data Management',
    icon: 'mdi-database',
    items: [
      {
        title: 'Version Your Data',
        description: 'Keep track of dataset versions to ensure reproducible results',
      },
      {
        title: 'Validate Data Quality',
        description: 'Check for missing values, outliers, and data consistency before training',
      },
      {
        title: 'Secure Sensitive Data',
        description: 'Use encryption and access controls for sensitive datasets',
      },
    ],
  },
  {
    category: 'Model Development',
    icon: 'mdi-brain',
    items: [
      {
        title: 'Start Simple',
        description: 'Begin with baseline models before trying complex architectures',
      },
      {
        title: 'Track Experiments',
        description: 'Log all hyperparameters, metrics, and model versions',
      },
      {
        title: 'Cross-Validate',
        description: 'Use proper validation techniques to assess model performance',
      },
    ],
  },
  {
    category: 'Production',
    icon: 'mdi-cloud',
    items: [
      {
        title: 'Monitor Performance',
        description: 'Set up monitoring and alerting for deployed models',
      },
      {
        title: 'A/B Test',
        description: 'Test new model versions against existing ones',
      },
      {
        title: 'Plan for Scale',
        description: 'Design deployments that can handle increased load',
      },
    ],
  },
];

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};
</script>

<style scoped>
.user-guide-page {
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

.nav-card,
.guide-section .v-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.guide-section {
  margin-bottom: 48px;
}

.step-item {
  border-left: 3px solid rgba(var(--v-theme-primary), 0.3);
  padding-left: 24px;
  position: relative;
}

.step-item::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 8px;
  width: 12px;
  height: 12px;
  background: rgba(var(--v-theme-primary), 0.8);
  border-radius: 50%;
}

.step-header {
  display: flex;
  align-items: center;
}

.api-code {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-x: auto;
}

.project-steps {
  list-style: none;
  counter-reset: step-counter;
  padding-left: 0;
}

.project-steps li {
  counter-increment: step-counter;
  position: relative;
  padding-left: 40px;
}

.project-steps li::before {
  content: counter(step-counter);
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(var(--v-theme-primary));
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: bold;
}

.training-stepper {
  background: transparent;
}

.deployment-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.feature-list {
  background: transparent;
}

.practice-list {
  background: transparent;
}

.tab-content {
  padding: 16px 0;
}

@media (max-width: 768px) {
  .user-guide-page {
    padding: 16px;
  }

  .step-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .step-header .v-chip {
    margin-bottom: 8px;
  }
}
</style>
