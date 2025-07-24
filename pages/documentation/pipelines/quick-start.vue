<template>
  <div class="pipelines-quick-start-page">
    <LayoutPageStructure
      title="Pipeline Builder Quick Start"
      subtitle="Create your first data pipeline in 5 minutes"
      :show-back-button="true"
      back-button-to="/documentation/pipelines"
    >
      <template #main>
        <div class="quick-start-content">
          <!-- Progress Indicator -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h6 bg-primary text-white">
              <v-icon class="mr-2">mdi-clock-fast</v-icon>
              5-Minute Pipeline Setup
            </v-card-title>
            <v-card-text class="pa-4">
              <v-progress-linear
                :model-value="progressValue"
                color="primary"
                height="8"
                rounded
                class="mb-3"
              />
              <p class="text-center text-body-2">
                Step {{ currentStep }} of {{ totalSteps }} - {{ currentStepTitle }}
              </p>
            </v-card-text>
          </v-card>

          <!-- Step-by-Step Guide -->
          <v-stepper
            v-model="currentStep"
            :items="steps"
            class="elevation-2"
            @update:model-value="updateProgress"
          >
            <!-- Step 1: Create Pipeline -->
            <template #item.1>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="primary" class="mb-3">mdi-timeline</v-icon>
                  <h2 class="text-h4 mb-2">Create Your Pipeline</h2>
                  <p class="text-body-1 mb-4">
                    Let's start by creating your first data pipeline. This takes just 30 seconds.
                  </p>
                </div>

                <v-alert type="info" variant="tonal" class="mb-4">
                  <template #prepend>
                    <v-icon>mdi-lightbulb</v-icon>
                  </template>
                  <strong>Pro Tip:</strong> Choose a specific use case for your pipeline to get better results.
                </v-alert>

                <div class="action-section">
                  <h3 class="text-h6 mb-3">Choose Your Pipeline Type:</h3>
                  <v-row>
                    <v-col
                      v-for="pipelineType in quickPipelineTypes"
                      :key="pipelineType.type"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <v-card
                        class="pipeline-type-card h-100"
                        :class="{ 'selected': selectedPipelineType === pipelineType.type }"
                        elevation="1"
                        @click="selectPipelineType(pipelineType.type)"
                      >
                        <v-card-text class="text-center">
                          <v-icon :color="pipelineType.color" size="32" class="mb-2">
                            {{ pipelineType.icon }}
                          </v-icon>
                          <h4 class="text-h6 mb-2">{{ pipelineType.title }}</h4>
                          <p class="text-body-2">{{ pipelineType.description }}</p>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>

                  <div class="mt-4">
                    <v-btn
                      color="primary"
                      size="large"
                      :disabled="!selectedPipelineType"
                      @click="nextStep"
                    >
                      Create {{ selectedPipelineType ? quickPipelineTypes.find(t => t.type === selectedPipelineType)?.title : 'Pipeline' }}
                      <v-icon right>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </div>
              </div>
            </template>

            <!-- Step 2: Configure -->
            <template #item.2>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="secondary" class="mb-3">mdi-cog</v-icon>
                  <h2 class="text-h4 mb-2">Configure Your Pipeline</h2>
                  <p class="text-body-1 mb-4">
                    Set up your data sources, transformations, and outputs.
                  </p>
                </div>

                <div class="configuration-section">
                  <h3 class="text-h6 mb-3">Pipeline Configuration:</h3>
                  
                  <v-form ref="form" v-model="isFormValid">
                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="pipelineConfig.name"
                          label="Pipeline Name"
                          placeholder="My Data Pipeline"
                          :rules="[v => !!v || 'Name is required']"
                          required
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-select
                          v-model="pipelineConfig.frequency"
                          label="Run Frequency"
                          :items="frequencyOptions"
                          :rules="[v => !!v || 'Frequency is required']"
                          required
                        />
                      </v-col>
                    </v-row>

                    <v-textarea
                      v-model="pipelineConfig.description"
                      label="Description"
                      placeholder="Describe what this pipeline does..."
                      rows="3"
                    />

                    <div class="mt-4">
                      <v-btn
                        color="secondary"
                        size="large"
                        :disabled="!isFormValid"
                        @click="nextStep"
                      >
                        Configure Data Sources
                        <v-icon right>mdi-arrow-right</v-icon>
                      </v-btn>
                    </div>
                  </v-form>
                </div>
              </div>
            </template>

            <!-- Step 3: Test -->
            <template #item.3>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="success" class="mb-3">mdi-play-circle</v-icon>
                  <h2 class="text-h4 mb-2">Test Your Pipeline</h2>
                  <p class="text-body-1 mb-4">
                    Run a test to make sure everything works correctly.
                  </p>
                </div>

                <div class="test-section">
                  <v-card class="mb-4" elevation="1">
                    <v-card-title class="text-h6">
                      <v-icon class="mr-2">mdi-test-tube</v-icon>
                      Pipeline Test
                    </v-card-title>
                    <v-card-text>
                      <div class="test-status">
                        <v-icon :color="testStatus.color" size="24" class="mr-2">
                          {{ testStatus.icon }}
                        </v-icon>
                        <span class="text-body-1">{{ testStatus.message }}</span>
                      </div>
                      
                      <div v-if="testResults.length > 0" class="mt-4">
                        <h4 class="text-subtitle-1 mb-2">Test Results:</h4>
                        <v-list density="compact">
                          <v-list-item
                            v-for="result in testResults"
                            :key="result.step"
                            :prepend-icon="result.success ? 'mdi-check-circle' : 'mdi-alert-circle'"
                            :color="result.success ? 'success' : 'error'"
                          >
                            <v-list-item-title>{{ result.step }}</v-list-item-title>
                            <v-list-item-subtitle>{{ result.message }}</v-list-item-subtitle>
                          </v-list-item>
                        </v-list>
                      </div>
                    </v-card-text>
                  </v-card>

                  <div class="mt-4">
                    <v-btn
                      color="success"
                      size="large"
                      :loading="isTesting"
                      @click="runTest"
                    >
                      <v-icon left>mdi-play</v-icon>
                      Run Test
                    </v-btn>
                    <v-btn
                      v-if="testCompleted"
                      color="primary"
                      size="large"
                      class="ml-2"
                      @click="nextStep"
                    >
                      Continue
                      <v-icon right>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </div>
              </div>
            </template>

            <!-- Step 4: Deploy -->
            <template #item.4>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="warning" class="mb-3">mdi-cloud-upload</v-icon>
                  <h2 class="text-h4 mb-2">Deploy Your Pipeline</h2>
                  <p class="text-body-1 mb-4">
                    Deploy your pipeline to start processing data automatically.
                  </p>
                </div>

                <div class="deploy-section">
                  <v-card class="mb-4" elevation="1">
                    <v-card-title class="text-h6">
                      <v-icon class="mr-2">mdi-rocket</v-icon>
                      Deployment Options
                    </v-card-title>
                    <v-card-text>
                      <v-row>
                        <v-col cols="12" md="6">
                          <v-card variant="outlined" class="h-100">
                            <v-card-title class="text-h6">
                              <v-icon class="mr-2" color="primary">mdi-cloud</v-icon>
                              Cloud Deployment
                            </v-card-title>
                            <v-card-text>
                              <p class="text-body-2 mb-3">Deploy to our managed cloud infrastructure</p>
                              <ul class="text-body-2">
                                <li>Automatic scaling</li>
                                <li>High availability</li>
                                <li>Managed monitoring</li>
                                <li>24/7 support</li>
                              </ul>
                            </v-card-text>
                          </v-card>
                        </v-col>
                        <v-col cols="12" md="6">
                          <v-card variant="outlined" class="h-100">
                            <v-card-title class="text-h6">
                              <v-icon class="mr-2" color="secondary">mdi-server</v-icon>
                              Self-Hosted
                            </v-card-title>
                            <v-card-text>
                              <p class="text-body-2 mb-3">Deploy on your own infrastructure</p>
                              <ul class="text-body-2">
                                <li>Full control</li>
                                <li>Custom configuration</li>
                                <li>Data sovereignty</li>
                                <li>Cost optimization</li>
                              </ul>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>
                    </v-card-text>
                  </v-card>

                  <div class="mt-4">
                    <v-btn
                      color="warning"
                      size="large"
                      :loading="isDeploying"
                      @click="deployPipeline"
                    >
                      <v-icon left>mdi-cloud-upload</v-icon>
                      Deploy Pipeline
                    </v-btn>
                    <v-btn
                      v-if="deploymentCompleted"
                      color="primary"
                      size="large"
                      class="ml-2"
                      @click="nextStep"
                    >
                      Continue
                      <v-icon right>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </div>
              </div>
            </template>

            <!-- Step 5: Success -->
            <template #item.5>
              <div class="step-content">
                <div class="step-header text-center">
                  <v-icon size="64" color="success" class="mb-3">mdi-check-circle</v-icon>
                  <h2 class="text-h4 mb-2">Pipeline Created Successfully!</h2>
                  <p class="text-body-1 mb-4">
                    Your data pipeline is now running and processing data automatically.
                  </p>
                </div>

                <div class="success-section">
                  <v-card class="mb-4" elevation="1">
                    <v-card-title class="text-h6">
                      <v-icon class="mr-2">mdi-information</v-icon>
                      What's Next?
                    </v-card-title>
                    <v-card-text>
                      <v-row>
                        <v-col cols="12" md="4">
                          <div class="text-center">
                            <v-icon size="48" color="primary" class="mb-2">mdi-chart-line</v-icon>
                            <h4 class="text-h6 mb-2">Monitor Performance</h4>
                            <p class="text-body-2">Track your pipeline's performance and data quality</p>
                            <v-btn
                              to="/pipelines/manage"
                              color="primary"
                              variant="outlined"
                              class="mt-2"
                            >
                              View Dashboard
                            </v-btn>
                          </div>
                        </v-col>
                        <v-col cols="12" md="4">
                          <div class="text-center">
                            <v-icon size="48" color="secondary" class="mb-2">mdi-cog</v-icon>
                            <h4 class="text-h6 mb-2">Customize Pipeline</h4>
                            <p class="text-body-2">Add more transformations and data sources</p>
                            <v-btn
                              to="/pipelines/create"
                              color="secondary"
                              variant="outlined"
                              class="mt-2"
                            >
                              Edit Pipeline
                            </v-btn>
                          </div>
                        </v-col>
                        <v-col cols="12" md="4">
                          <div class="text-center">
                            <v-icon size="48" color="success" class="mb-2">mdi-plus</v-icon>
                            <h4 class="text-h6 mb-2">Create More</h4>
                            <p class="text-body-2">Build additional pipelines for different use cases</p>
                            <v-btn
                              to="/pipelines/create"
                              color="success"
                              variant="outlined"
                              class="mt-2"
                            >
                              New Pipeline
                            </v-btn>
                          </div>
                        </v-col>
                      </v-row>
                    </v-card-text>
                  </v-card>
                </div>
              </div>
            </template>
          </v-stepper>

          <!-- Help Section -->
          <v-card class="mt-6" elevation="1">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-help-circle</v-icon>
              Need Help?
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <h4 class="text-subtitle-1 mb-2">Quick Links:</h4>
                  <ul>
                    <li><a href="/documentation/pipelines" class="text-primary">Full Pipeline Documentation</a></li>
                    <li><a href="/tutorials" class="text-primary">Video Tutorials</a></li>
                    <li><a href="/api-reference" class="text-primary">API Reference</a></li>
                  </ul>
                </v-col>
                <v-col cols="12" md="6">
                  <h4 class="text-subtitle-1 mb-2">Get Support:</h4>
                  <v-btn
                    to="/support"
                    color="info"
                    variant="outlined"
                    class="mr-2 mb-2"
                  >
                    <v-icon left>mdi-help</v-icon>
                    Support Center
                  </v-btn>
                  <v-btn
                    to="/community"
                    color="success"
                    variant="outlined"
                    class="mb-2"
                  >
                    <v-icon left>mdi-forum</v-icon>
                    Community
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'

// Set page meta
useHead({
  title: 'Pipeline Builder Quick Start - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Get started with Cloudless.gr Pipeline Builder in 5 minutes. Create, configure, test, and deploy your first data pipeline quickly and easily.' },
    { property: 'og:title', content: 'Pipeline Builder Quick Start - Cloudless.gr' },
    { property: 'og:description', content: 'Create your first data pipeline in just 5 minutes with our step-by-step quick start guide.' }
  ]
})

// Reactive data
const currentStep = ref(1)
const totalSteps = 5
const selectedPipelineType = ref('')
const isFormValid = ref(false)
const isTesting = ref(false)
const isDeploying = ref(false)
const testCompleted = ref(false)
const deploymentCompleted = ref(false)

// Pipeline configuration
const pipelineConfig = ref({
  name: '',
  description: '',
  frequency: ''
})

// Test status and results
const testStatus = ref({
  message: 'Ready to test your pipeline',
  icon: 'mdi-play-circle',
  color: 'primary'
})

const testResults = ref([])

// Computed
const progressValue = computed(() => (currentStep.value / totalSteps) * 100)
const currentStepTitle = computed(() => {
  const titles = ['Create Pipeline', 'Configure', 'Test', 'Deploy', 'Success']
  return titles[currentStep.value - 1] || ''
})

// Steps configuration
const steps = [
  { title: 'Create', value: '1' },
  { title: 'Configure', value: '2' },
  { title: 'Test', value: '3' },
  { title: 'Deploy', value: '4' },
  { title: 'Success', value: '5' }
]

// Quick pipeline types
const quickPipelineTypes = [
  {
    type: 'etl',
    title: 'ETL Pipeline',
    description: 'Extract, transform, and load data from multiple sources',
    icon: 'mdi-database-sync',
    color: 'primary'
  },
  {
    type: 'analytics',
    title: 'Analytics Pipeline',
    description: 'Process data for real-time analytics and reporting',
    icon: 'mdi-chart-line',
    color: 'success'
  },
  {
    type: 'monitoring',
    title: 'Monitoring Pipeline',
    description: 'Monitor data quality and system performance',
    icon: 'mdi-monitor-dashboard',
    color: 'warning'
  }
]

// Frequency options
const frequencyOptions = [
  'Every 5 minutes',
  'Every 15 minutes',
  'Every hour',
  'Daily',
  'Weekly',
  'On-demand'
]

// Methods
const updateProgress = () => {
  // Progress is handled by computed property
}

const selectPipelineType = (type: string) => {
  selectedPipelineType.value = type
}

const nextStep = () => {
  if (currentStep.value < totalSteps) {
    currentStep.value++
  }
}

const runTest = async () => {
  isTesting.value = true
  testStatus.value = {
    message: 'Running pipeline test...',
    icon: 'mdi-loading',
    color: 'warning'
  }

  // Simulate test execution
  await new Promise(resolve => setTimeout(resolve, 2000))

  testResults.value = [
    { step: 'Data Source Connection', success: true, message: 'Successfully connected to data source' },
    { step: 'Data Validation', success: true, message: 'All data passed validation checks' },
    { step: 'Transformation Processing', success: true, message: 'Data transformations completed successfully' },
    { step: 'Output Delivery', success: true, message: 'Data delivered to destination' }
  ]

  testStatus.value = {
    message: 'Pipeline test completed successfully!',
    icon: 'mdi-check-circle',
    color: 'success'
  }

  testCompleted.value = true
  isTesting.value = false
}

const deployPipeline = async () => {
  isDeploying.value = true

  // Simulate deployment
  await new Promise(resolve => setTimeout(resolve, 3000))

  deploymentCompleted.value = true
  isDeploying.value = false
}
</script>

<style scoped>
.pipelines-quick-start-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.quick-start-content {
  max-width: 1000px;
  margin: 0 auto;
}

.step-content {
  padding: 2rem;
}

.step-header {
  text-align: center;
  margin-bottom: 2rem;
}

.action-section,
.configuration-section,
.test-section,
.deploy-section,
.success-section {
  margin-top: 2rem;
}

.pipeline-type-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.pipeline-type-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pipeline-type-card.selected {
  border-color: var(--v-primary-base);
  background-color: var(--v-primary-lighten5);
}

.test-status {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--v-surface-variant);
  border-radius: 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .step-content {
    padding: 1rem;
  }
  
  .pipeline-type-card {
    margin-bottom: 1rem;
  }
}
</style> 