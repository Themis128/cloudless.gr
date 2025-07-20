<template>
  <div>
    <PageStructure
      title="Test Projects"
      subtitle="Validate and test your project configurations and workflows"
      back-button-to="/projects"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Project Selection -->
        <v-card class="mb-4">
          <v-card-title class="text-h6 test-page-title">
            <v-icon start color="primary">
              mdi-folder-multiple
            </v-icon>
            Select Project to Test
          </v-card-title>
          <v-card-text>
            <v-select
              v-model="selectedProject"
              :items="availableProjects"
              item-title="name"
              item-value="id"
              label="Choose a project"
              variant="outlined"
              :loading="loading"
              :disabled="loading"
              prepend-icon="mdi-folder"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props">
                  <template #prepend>
                    <v-icon color="primary">
                      mdi-folder
                    </v-icon>
                  </template>
                  <v-list-item-title>
                    {{ item.raw.name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ item.raw.description || 'No description' }}
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-select>
            
            <div v-if="selectedProject" class="mt-4">
              <v-alert type="info" variant="tonal">
                <strong>Project Details:</strong>
                <div class="mt-2">
                  <div><strong>Bots:</strong> {{ selectedProjectData?.bots?.length || 0 }}</div>
                  <div><strong>Models:</strong> {{ selectedProjectData?.models?.length || 0 }}</div>
                  <div><strong>Pipelines:</strong> {{ selectedProjectData?.pipelines?.length || 0 }}</div>
                </div>
              </v-alert>
            </div>
          </v-card-text>
        </v-card>

        <!-- Test Configuration -->
        <v-card v-if="selectedProject" class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-cog
            </v-icon>
            Test Configuration
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="testScenario"
                  :items="testScenarios"
                  label="Test Scenario"
                  variant="outlined"
                  prepend-icon="mdi-playlist-check"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="testDepth"
                  :items="testDepths"
                  label="Test Depth"
                  variant="outlined"
                  prepend-icon="mdi-layers"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="customTestData"
                  label="Custom Test Data (Optional)"
                  variant="outlined"
                  placeholder="Enter custom test data or leave empty for default scenarios"
                  rows="3"
                  prepend-icon="mdi-text"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Test Execution -->
        <v-card v-if="selectedProject" class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-play-circle
            </v-icon>
            Test Execution
          </v-card-title>
          <v-card-text>
            <div class="d-flex gap-3 mb-4">
              <v-btn
                color="primary"
                size="large"
                :loading="testing"
                :disabled="testing"
                prepend-icon="mdi-play"
                @click="runTest"
              >
                Run Test
              </v-btn>
              <v-btn
                color="secondary"
                size="large"
                :disabled="!testResults.length"
                prepend-icon="mdi-delete"
                @click="clearResults"
              >
                Clear Results
              </v-btn>
            </div>

            <!-- Test Progress -->
            <div v-if="testing" class="mb-4">
              <v-progress-linear
                v-model="testProgress"
                color="primary"
                height="8"
                rounded
              />
              <div class="text-center mt-2">
                <v-chip color="info" class="mr-2">
                  {{ currentTestStep }}
                </v-chip>
                <span class="text-body-2">{{ testProgress }}% Complete</span>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Test Results -->
        <v-card v-if="testResults.length > 0" class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="success">
              mdi-check-circle
            </v-icon>
            Test Results
          </v-card-title>
          <v-card-text>
            <v-alert
              :type="overallStatus === 'success' ? 'success' : overallStatus === 'warning' ? 'warning' : 'error'"
              variant="tonal"
              class="mb-4"
            >
              <strong>Overall Status:</strong> {{ overallStatus.toUpperCase() }}
            </v-alert>

            <v-expansion-panels>
              <v-expansion-panel
                v-for="(result, index) in testResults"
                :key="index"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center">
                    <v-icon
                      :color="result.status === 'success' ? 'success' : result.status === 'warning' ? 'warning' : 'error'"
                      class="mr-2"
                    >
                      {{ result.status === 'success' ? 'mdi-check-circle' : result.status === 'warning' ? 'mdi-alert' : 'mdi-close-circle' }}
                    </v-icon>
                    {{ result.name }}
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="mb-2">
                    <strong>Status:</strong> {{ result.status }}
                  </div>
                  <div class="mb-2">
                    <strong>Duration:</strong> {{ result.duration }}ms
                  </div>
                  <div v-if="result.message" class="mb-2">
                    <strong>Message:</strong> {{ result.message }}
                  </div>
                  <div v-if="result.details" class="mb-2">
                    <strong>Details:</strong>
                    <pre class="mt-1 pa-2 bg-grey-lighten-4 rounded">{{ JSON.stringify(result.details, null, 2) }}</pre>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>

        <!-- No Project Selected -->
        <v-card v-if="!selectedProject" class="mb-4">
          <v-card-text class="text-center py-8">
            <v-icon size="64" color="black" class="mb-4">
              mdi-folder-open
            </v-icon>
            <h3 class="text-h6 mb-2">
              No Project Selected
            </h3>
            <p class="text-body-2 text-medium-emphasis">
              Please select a project from the dropdown above to begin testing.
            </p>
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <ProjectGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'

interface Project {
  id: string
  name: string
  description?: string
  bots?: any[]
  models?: any[]
  pipelines?: any[]
}

interface TestResult {
  name: string
  status: 'success' | 'warning' | 'error'
  duration: number
  message?: string
  details?: any
}

const loading = ref(false)
const testing = ref(false)
const testProgress = ref(0)
const currentTestStep = ref('')
const selectedProject = ref('')
const testScenario = ref('')
const testDepth = ref('')
const customTestData = ref('')
const testResults = ref<TestResult[]>([])

const availableProjects = ref<Project[]>([
  {
    id: '1',
    name: 'AI Chatbot',
    description: 'Customer service chatbot',
    bots: [1, 2],
    models: [1],
    pipelines: [1]
  },
  {
    id: '2',
    name: 'Data Pipeline',
    description: 'ETL pipeline for analytics',
    bots: [],
    models: [2, 3],
    pipelines: [2, 3]
  }
])

const testScenarios = [
  'Basic Functionality',
  'Performance Test',
  'Integration Test',
  'Stress Test',
  'Custom Scenario'
]

const testDepths = [
  'Quick Test',
  'Standard Test',
  'Comprehensive Test',
  'Full Validation'
]

const selectedProjectData = computed(() => 
  availableProjects.value.find(p => p.id === selectedProject.value)
)

const overallStatus = computed(() => {
  if (!testResults.value.length) return 'pending'
  
  const hasErrors = testResults.value.some(r => r.status === 'error')
  const hasWarnings = testResults.value.some(r => r.status === 'warning')
  
  if (hasErrors) return 'error'
  if (hasWarnings) return 'warning'
  return 'success'
})

const runTest = async () => {
  testing.value = true
  testProgress.value = 0
  testResults.value = []
  
  const steps = ['Initializing', 'Testing Bots', 'Testing Models', 'Testing Pipelines', 'Validating Results']
  
  for (let i = 0; i < steps.length; i++) {
    currentTestStep.value = steps[i]
    testProgress.value = (i / (steps.length - 1)) * 100
    
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Add mock test results
    testResults.value.push({
      name: steps[i],
      status: Math.random() > 0.2 ? 'success' : Math.random() > 0.5 ? 'warning' : 'error',
      duration: Math.floor(Math.random() * 1000) + 100,
      message: Math.random() > 0.8 ? 'Test completed successfully' : undefined,
      details: Math.random() > 0.7 ? { timestamp: new Date().toISOString() } : undefined
    })
  }
  
  testing.value = false
  testProgress.value = 100
  currentTestStep.value = 'Completed'
}

const clearResults = () => {
  testResults.value = []
  testProgress.value = 0
  currentTestStep.value = ''
}

onMounted(() => {
  // Load available projects
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 1000)
})
</script>

<style scoped>
.gap-3 {
  gap: 1rem;
}

.test-page-title {
  color: black !important;
}

/* Make dropdown text black */
:deep(.v-select .v-field__input) {
  color: black !important;
}

:deep(.v-select .v-field__input::placeholder) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-list-item-title) {
  color: black !important;
}

:deep(.v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.7) !important;
}

:deep(.v-select .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}
</style> 