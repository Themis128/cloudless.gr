<template>
  <div>
    <PageStructure
      title="Test Pipeline"
      subtitle="Test your data processing pipelines with sample data"
      back-button-to="/pipelines"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Pipeline Selection -->
        <v-card class="mb-4">
          <v-card-title>Select Pipeline to Test</v-card-title>
          <v-divider />
          <v-card-text>
            <v-select
              v-model="selectedPipeline"
              :items="availablePipelines"
              item-title="name"
              item-value="id"
              label="Choose a Pipeline"
              variant="outlined"
              class="mb-3"
              :loading="loadingPipelines"
              :disabled="loadingPipelines"
              prepend-icon="mdi-pipe"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props">
                  <template #prepend>
                    <v-avatar color="primary" size="32">
                      <v-icon color="white">
                        {{ getPipelineIcon(item.raw.type) }}
                      </v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ item.raw.type }} • {{ item.raw.status }}
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-select>
            
            <v-alert
              v-if="selectedPipelineInfo"
              type="info"
              variant="tonal"
              class="mb-3"
            >
              <strong>Pipeline Info:</strong> {{ selectedPipelineInfo.type }} pipeline with {{ selectedPipelineInfo.status }} status
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Test Configuration -->
        <v-card v-if="selectedPipeline" class="mb-4">
          <v-card-title>Test Configuration</v-card-title>
          <v-divider />
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="testScenario"
                  :items="testScenarios"
                  item-title="name"
                  item-value="id"
                  label="Test Scenario"
                  variant="outlined"
                  class="mb-3"
                  prepend-icon="mdi-test-tube"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="batchSize"
                  label="Batch Size"
                  type="number"
                  min="1"
                  max="1000"
                  variant="outlined"
                  class="mb-3"
                  prepend-icon="mdi-package-variant"
                />
              </v-col>
            </v-row>
            
            <v-textarea
              v-model="customInput"
              label="Custom Input Data (optional)"
              variant="outlined"
              rows="4"
              class="mb-3"
              placeholder="Enter custom input data in JSON format..."
              prepend-icon="mdi-json"
            />
            
            <v-alert
              v-if="currentScenario"
              type="info"
              variant="tonal"
              class="mb-3"
            >
              <strong>Scenario:</strong> {{ currentScenario.description }}
            </v-alert>
            
            <div class="d-flex gap-3">
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-play"
                :loading="testing"
                :disabled="!selectedPipeline || !testScenario"
                size="large"
                @click="startTest"
              >
                Start Test
              </v-btn>
              <v-btn
                color="secondary"
                variant="outlined"
                prepend-icon="mdi-refresh"
                :disabled="testing"
                size="large"
                @click="clearTest"
              >
                Clear Test
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Test Results -->
        <v-card v-if="testResults.length > 0">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Test Results</span>
            <v-chip color="success" size="small">
              {{ testResults.length }} test{{ testResults.length > 1 ? 's' : '' }}
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <div v-for="(result, index) in testResults" :key="index" class="mb-4">
              <v-card variant="outlined" class="mb-3">
                <v-card-title class="text-subtitle-1">
                  Test #{{ index + 1 }} - {{ result.scenario }}
                  <v-chip
                    :color="result.success ? 'success' : 'error'"
                    size="small"
                    class="ml-2"
                  >
                    {{ result.success ? 'Success' : 'Error' }}
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <div class="mb-3">
                    <strong>Pipeline:</strong> {{ result.pipelineName }}
                  </div>
                  
                  <div class="mb-3">
                    <strong>Processing Steps:</strong>
                    <div class="steps-container mt-2">
                      <div v-for="(step, stepIndex) in result.steps" :key="stepIndex" class="step-item mb-2">
                        <div class="step-header">
                          <v-icon 
                            size="16" 
                            :color="getStepColor(step.status)"
                            class="mr-2"
                          >
                            {{ getStepIcon(step.status) }}
                          </v-icon>
                          <span class="font-weight-medium">{{ step.name }}</span>
                          <v-chip size="x-small" :color="getStepColor(step.status)" class="ml-2">
                            {{ step.status }}
                          </v-chip>
                        </div>
                        <div v-if="step.result" class="step-result mt-1">
                          <div class="text-caption text-medium-emphasis">
                            Output:
                          </div>
                          <div class="text-body-2 bg-grey-lighten-4 p-2 rounded">
                            {{ step.result }}
                          </div>
                        </div>
                        <div v-if="step.error" class="step-error mt-1">
                          <div class="text-caption text-error">
                            Error:
                          </div>
                          <div class="text-body-2 bg-red-lighten-5 p-2 rounded">
                            {{ step.error }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="result.error" class="mb-3">
                    <strong>Pipeline Error:</strong>
                    <div class="text-body-2 bg-red-lighten-5 p-2 rounded mt-1">
                      {{ result.error }}
                    </div>
                  </div>
                  
                  <div class="d-flex gap-4 text-caption text-medium-emphasis">
                    <span>
                      <v-icon size="16" class="mr-1">mdi-clock</v-icon>
                      {{ result.duration }}ms
                    </span>
                    <span>
                      <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                      {{ formatDate(result.timestamp) }}
                    </span>
                    <span>
                      <v-icon size="16" class="mr-1">mdi-package-variant</v-icon>
                      {{ result.batchSize }} items
                    </span>
                    <span>
                      <v-icon size="16" class="mr-1">mdi-pipe</v-icon>
                      {{ result.steps.length }} steps
                    </span>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>

        <!-- Error Alert -->
        <v-alert v-if="error" type="error" class="mt-4">
          {{ error }}
        </v-alert>
      </template>

      <template #sidebar>
        <PipelineGuide page="test" />
        
        <v-card class="mb-4">
          <v-card-title>Test Settings</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Test Scenarios
                </v-list-item-title>
                <v-list-item-subtitle>Predefined data processing flows</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Batch Size
                </v-list-item-title>
                <v-list-item-subtitle>Number of items to process (1-1000)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Custom Input
                </v-list-item-title>
                <v-list-item-subtitle>Test with your own data</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Pipeline Status
                </v-list-item-title>
                <v-list-item-subtitle>Only active pipelines can be tested</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Quick Actions</v-card-title>
          <v-card-text>
            <v-btn
              to="/pipelines"
              color="primary"
              variant="outlined"
              block
              class="mb-2"
              prepend-icon="mdi-arrow-left"
            >
              Back to Pipelines
            </v-btn>
            <v-btn
              to="/pipelines/create"
              color="success"
              variant="outlined"
              block
              class="mb-2"
              prepend-icon="mdi-plus"
            >
              Create New Pipeline
            </v-btn>
            <v-btn
              to="/pipelines"
              color="secondary"
              variant="outlined"
              block
              prepend-icon="mdi-pipe"
            >
              Manage Pipelines
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'
import { usePrismaStore } from '~/stores/usePrismaStore'

interface Pipeline {
  id: number
  name: string
  type?: string
  status?: string
  description?: string
  config?: string
}

interface TestScenario {
  id: string
  name: string
  description: string
  inputData: any
}

interface PipelineStep {
  name: string
  status: 'pending' | 'running' | 'complete' | 'error'
  result?: string
  error?: string
  duration?: number
}

interface TestResult {
  pipelineId: number
  pipelineName: string
  scenario: string
  steps: PipelineStep[]
  success: boolean
  error?: string
  duration: number
  timestamp: string
  batchSize: number
}

const { getPipelines } = usePrismaStore()

const availablePipelines = ref<Pipeline[]>([])
const selectedPipeline = ref<string>('')
const testScenario = ref<string>('')
const customInput = ref('')
const batchSize = ref(10)
const testing = ref(false)
const error = ref<string | null>(null)
const testResults = ref<TestResult[]>([])
const loadingPipelines = ref(false)

// Test scenarios
const testScenarios = ref<TestScenario[]>([
  {
    id: 'text-processing',
    name: 'Text Processing',
    description: 'Process and analyze text data with NLP techniques',
    inputData: {
      text: 'Sample text for processing and analysis',
      language: 'en',
      tasks: ['tokenization', 'sentiment', 'entities']
    }
  },
  {
    id: 'data-transformation',
    name: 'Data Transformation',
    description: 'Transform and clean structured data',
    inputData: {
      data: [
        { id: 1, name: 'John', age: 30, city: 'New York' },
        { id: 2, name: 'Jane', age: 25, city: 'Los Angeles' }
      ],
      operations: ['clean', 'normalize', 'validate']
    }
  },
  {
    id: 'image-processing',
    name: 'Image Processing',
    description: 'Process and analyze image data',
    inputData: {
      image_url: 'https://example.com/sample.jpg',
      operations: ['resize', 'filter', 'analyze'],
      format: 'jpeg'
    }
  },
  {
    id: 'ml-inference',
    name: 'ML Inference',
    description: 'Run machine learning model inference',
    inputData: {
      features: [0.1, 0.2, 0.3, 0.4, 0.5],
      model_type: 'classification',
      threshold: 0.5
    }
  },
  {
    id: 'custom',
    name: 'Custom Input',
    description: 'Test with your own custom data',
    inputData: {}
  }
])

// Computed properties
const selectedPipelineInfo = computed(() => {
  return availablePipelines.value.find(pipeline => pipeline.id === selectedPipeline.value)
})

const currentScenario = computed(() => {
  return testScenarios.value.find(scenario => scenario.id === testScenario.value)
})

// Helper functions
const getPipelineIcon = (type?: string) => {
  const icons: Record<string, string> = {
    'Data Processing': 'mdi-database',
    'Text Analysis': 'mdi-text',
    'Image Processing': 'mdi-image',
    'ML Pipeline': 'mdi-brain',
    'ETL': 'mdi-transfer',
    'Custom': 'mdi-cog'
  }
  return icons[type || ''] || 'mdi-pipe'
}

const getStepIcon = (status: string) => {
  const icons: Record<string, string> = {
    'pending': 'mdi-clock-outline',
    'running': 'mdi-loading',
    'complete': 'mdi-check-circle',
    'error': 'mdi-alert-circle'
  }
  return icons[status] || 'mdi-help-circle'
}

const getStepColor = (status: string) => {
  const colors: Record<string, string> = {
    'pending': 'grey',
    'running': 'primary',
    'complete': 'success',
    'error': 'error'
  }
  return colors[status] || 'grey'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Action handlers
const startTest = async () => {
  if (!selectedPipeline.value || !testScenario.value) return
  
  testing.value = true
  error.value = null
  
  const startTime = Date.now()
  
  try {
    const pipeline = selectedPipelineInfo.value
    const scenario = currentScenario.value
    
    if (!pipeline || !scenario) {
      throw new Error('Invalid pipeline or scenario selection')
    }
    
    // Simulate pipeline testing
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    const duration = Date.now() - startTime
    
    // Generate pipeline steps based on scenario
    const steps: PipelineStep[] = []
    let success = true
    let testError: string | undefined = undefined
    
    if (Math.random() > 0.1) { // 90% success rate
      const stepNames = generatePipelineSteps(pipeline.type, scenario.id)
      
      for (let i = 0; i < stepNames.length; i++) {
        const stepName = stepNames[i]
        
        // Simulate step processing
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500))
        
        const stepSuccess = Math.random() > 0.05 // 95% step success rate
        
        if (stepSuccess) {
          steps.push({
            name: stepName,
            status: 'complete',
            result: generateStepResult(stepName),
            duration: Math.floor(Math.random() * 300) + 100
          })
        } else {
          steps.push({
            name: stepName,
            status: 'error',
            error: `Failed to process ${stepName}: Internal error`,
            duration: Math.floor(Math.random() * 200) + 50
          })
          success = false
          break
        }
      }
    } else {
      success = false
      testError = 'Pipeline execution failed: Resource timeout'
      steps.push({
        name: 'Initialization',
        status: 'error',
        error: testError
      })
    }
    
    const result: TestResult = {
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      scenario: scenario.name,
      steps,
      success,
      error: testError,
      duration,
      timestamp: new Date().toISOString(),
      batchSize: batchSize.value
    }
    
    testResults.value.unshift(result)
    
    // Clear custom input for next test
    customInput.value = ''
    
  } catch (err) {
    error.value = 'Failed to test pipeline'
  } finally {
    testing.value = false
  }
}

const generatePipelineSteps = (pipelineType?: string, scenarioId?: string): string[] => {
  const stepTemplates: Record<string, string[]> = {
    'Data Processing': ['Data Validation', 'Data Cleaning', 'Data Transformation', 'Data Export'],
    'Text Analysis': ['Text Preprocessing', 'Tokenization', 'Feature Extraction', 'Analysis'],
    'Image Processing': ['Image Loading', 'Preprocessing', 'Feature Extraction', 'Post-processing'],
    'ML Pipeline': ['Data Loading', 'Feature Engineering', 'Model Inference', 'Result Processing'],
    'ETL': ['Extract', 'Transform', 'Load', 'Validate'],
    'Custom': ['Input Processing', 'Custom Logic', 'Output Generation']
  }
  
  // Add scenario-specific steps first
  if (scenarioId === 'text-processing') {
    return ['Text Input', 'Language Detection', 'Tokenization', 'Sentiment Analysis', 'Entity Recognition']
  } else if (scenarioId === 'data-transformation') {
    return ['Data Validation', 'Schema Check', 'Data Cleaning', 'Transformation', 'Output Formatting']
  } else if (scenarioId === 'image-processing') {
    return ['Image Loading', 'Resize', 'Filter Application', 'Feature Detection', 'Result Export']
  } else if (scenarioId === 'ml-inference') {
    return ['Feature Preparation', 'Model Loading', 'Inference', 'Post-processing', 'Result Formatting']
  }
  
  // Fall back to pipeline type templates
  const steps = stepTemplates[pipelineType || 'Custom'] || stepTemplates['Custom']
  return steps
}

const generateStepResult = (stepName: string): string => {
  const results: Record<string, string> = {
    'Text Input': 'Text loaded successfully (32 characters)',
    'Language Detection': 'Language: English (confidence: 0.95)',
    'Tokenization': 'Tokens: ["Sample", "text", "for", "processing"]',
    'Sentiment Analysis': 'Sentiment: Neutral (score: 0.1)',
    'Entity Recognition': 'Entities: [{"text": "Sample", "type": "ORG"}]',
    'Data Validation': 'Validation passed: 2 records processed',
    'Schema Check': 'Schema validation successful',
    'Data Cleaning': 'Cleaned 2 records, removed 0 invalid entries',
    'Transformation': 'Transformed data structure successfully',
    'Output Formatting': 'Output formatted as JSON',
    'Image Loading': 'Image loaded: 1920x1080 pixels',
    'Resize': 'Image resized to 800x600 pixels',
    'Filter Application': 'Applied Gaussian blur filter',
    'Feature Detection': 'Detected 15 features',
    'Result Export': 'Results exported to output directory',
    'Feature Preparation': 'Features normalized and scaled',
    'Model Loading': 'Model loaded successfully',
    'Inference': 'Prediction: Class A (confidence: 0.87)',
    'Post-processing': 'Results post-processed and validated',
    'Result Formatting': 'Results formatted for output'
  }
  
  return results[stepName] || `Step "${stepName}" completed successfully`
}

const clearTest = () => {
  testResults.value = []
  error.value = null
  customInput.value = ''
}

// Load available pipelines
const loadPipelines = async () => {
  loadingPipelines.value = true
  error.value = null
  
  try {
    const data = await getPipelines()
    
    // Filter for active pipelines
    availablePipelines.value = data.filter((pipeline: any) => pipeline.status === 'active') || []
  } catch (err) {
    error.value = 'Failed to load pipelines'
  } finally {
    loadingPipelines.value = false
  }
}

onMounted(() => {
  loadPipelines()
})
</script>

<style scoped>
.steps-container {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.step-item {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  border-left: 3px solid var(--v-primary-base);
}

.step-header {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.step-result {
  margin-top: 0.5rem;
}

.step-error {
  margin-top: 0.5rem;
}

.v-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style> 