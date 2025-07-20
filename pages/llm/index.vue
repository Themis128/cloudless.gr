<template>
  <div>
    <PageStructure
      title="LLM Management"
      subtitle="Manage your language models, training sessions, and deployments"
      back-button-to="/"
      :has-sidebar="true"
    >
      <template #main>
        <!-- Quick Actions -->
        <v-card class="mb-4 bg-white">
          <v-card-title class="text-h6">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <p class="text-body-2 text-medium-emphasis">
                  Train, deploy, or manage language models
                </p>
              </div>
            </div>
            <div class="quick-actions-buttons">
              <v-btn
                to="/llm/train"
                color="primary"
                prepend-icon="mdi-school"
                variant="elevated"
                class="action-btn"
                size="large"
              >
                Train Model
              </v-btn>
              <v-btn
                to="/llm/models"
                color="info"
                prepend-icon="mdi-brain"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Manage Models
              </v-btn>
              <v-btn
                to="/llm/training"
                color="warning"
                prepend-icon="mdi-clock"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Training Sessions
              </v-btn>
              <v-btn
                to="/llm/deployments"
                color="success"
                prepend-icon="mdi-rocket-launch"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                View Deployments
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Navigation Cards -->
        <v-row class="mb-6">
          <v-col cols="12" md="3">
            <v-card 
              class="nav-card bg-white" 
              style="cursor: pointer;"
              @click="navigateToPage('/llm/models')"
            >
              <v-card-text class="text-center">
                <v-icon color="primary" size="48" class="mb-2">
                  mdi-brain
                </v-icon>
                <div class="text-h6 font-weight-bold mb-2">
                  Models
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Manage and monitor your trained models
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card 
              class="nav-card bg-white" 
              style="cursor: pointer;"
              @click="navigateToPage('/llm/training')"
            >
              <v-card-text class="text-center">
                <v-icon color="warning" size="48" class="mb-2">
                  mdi-school
                </v-icon>
                <div class="text-h6 font-weight-bold mb-2">
                  Training
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Monitor training sessions and logs
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card 
              class="nav-card bg-white" 
              style="cursor: pointer;"
              @click="navigateToPage('/llm/datasets')"
            >
              <v-card-text class="text-center">
                <v-icon color="info" size="48" class="mb-2">
                  mdi-database
                </v-icon>
                <div class="text-h6 font-weight-bold mb-2">
                  Datasets
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Manage training datasets
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card 
              class="nav-card bg-white" 
              style="cursor: pointer;"
              @click="navigateToPage('/llm/analytics')"
            >
              <v-card-text class="text-center">
                <v-icon color="success" size="48" class="mb-2">
                  mdi-chart-line
                </v-icon>
                <div class="text-h6 font-weight-bold mb-2">
                  Analytics
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Performance and cost analysis
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Stats Cards -->
        <v-row class="mb-6">
          <v-col cols="12" md="3">
            <v-card class="stats-card bg-white">
              <v-card-text class="text-center">
                <v-icon color="primary" size="48" class="mb-2">
                  mdi-brain
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ models.length }}
                </div>
                <div class="text-body-2">
                  Active Models
                </div>
                <div class="text-caption text-medium-emphasis">
                  Ready for deployment
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card bg-white">
              <v-card-text class="text-center">
                <v-icon color="success" size="48" class="mb-2">
                  mdi-school
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ trainingStats.completed }}
                </div>
                <div class="text-body-2">
                  Completed Training
                </div>
                <div class="text-caption text-medium-emphasis">
                  Successfully trained models
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card bg-white">
              <v-card-text class="text-center">
                <v-icon color="warning" size="48" class="mb-2">
                  mdi-cog
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ trainingStats.running }}
                </div>
                <div class="text-body-2">
                  Training in Progress
                </div>
                <div class="text-caption text-medium-emphasis">
                  Currently training models
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card bg-white">
              <v-card-text class="text-center">
                <v-icon color="info" size="48" class="mb-2">
                  mdi-rocket
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ deploymentStats.active }}
                </div>
                <div class="text-body-2">
                  Active Deployments
                </div>
                <div class="text-caption text-medium-emphasis">
                  Live model endpoints
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Main Content Tabs -->
        <v-tabs v-model="activeTab" class="mb-4">
          <v-tab value="models">
            Models
          </v-tab>
          <v-tab value="training">
            Training Sessions
          </v-tab>
          <v-tab value="deployments">
            Deployments
          </v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab">
          <!-- Models Tab -->
          <v-tabs-window-item value="models">
            <v-card class="bg-white">
              <v-card-title class="d-flex justify-space-between align-center">
                <div class="d-flex align-center">
                  <v-icon start color="primary">
                    mdi-brain
                  </v-icon>
                  Available Models
                </div>
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  :loading="loadingModels"
                  @click="refreshModels"
                >
                  Refresh
                </v-btn>
              </v-card-title>
              <v-card-text>
                <v-data-table
                  :headers="modelHeaders"
                  :items="models"
                  :loading="loadingModels"
                  class="elevation-0 models-table"
                  :items-per-page="10"
                  :items-per-page-options="[5, 10, 25, 50]"
                >
                  <template #item.name="{ item }">
                    <div class="d-flex align-center">
                      <v-icon class="me-2" color="primary">
                        mdi-brain
                      </v-icon>
                      <span class="font-weight-medium">{{ item.name }}</span>
                    </div>
                  </template>

                  <template #item.status="{ item }">
                    <v-chip
                      :color="getStatusColor(item.status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ item.status }}
                    </v-chip>
                  </template>

                  <template #item.actions="{ item }">
                    <div class="d-flex gap-1">
                      <v-btn
                        icon="mdi-eye"
                        size="small"
                        variant="text"
                        color="primary"
                        @click="() => viewModel(item)"
                      />
                      <v-btn
                        icon="mdi-pencil"
                        size="small"
                        variant="text"
                        color="warning"
                        @click="() => editModel(item)"
                      />
                      <v-btn
                        icon="mdi-rocket-launch"
                        size="small"
                        variant="text"
                        color="success"
                        @click="() => deployModel(item)"
                      />
                    </div>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-tabs-window-item>

          <!-- Training Sessions Tab -->
          <v-tabs-window-item value="training">
            <v-card class="bg-white">
              <v-card-title class="d-flex justify-space-between align-center">
                <div class="d-flex align-center">
                  <v-icon start color="primary">
                    mdi-school
                  </v-icon>
                  Training Sessions
                </div>
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  :loading="loadingTraining"
                  @click="refreshTraining"
                >
                  Refresh
                </v-btn>
              </v-card-title>
              <v-card-text>
                <v-data-table
                  :headers="trainingHeaders"
                  :items="trainingSessions"
                  :loading="loadingTraining"
                  class="elevation-0 training-table"
                  :items-per-page="10"
                  :items-per-page-options="[5, 10, 25, 50]"
                >
                  <template #item.name="{ item }">
                    <div class="d-flex align-center">
                      <v-icon class="me-2" color="primary">
                        mdi-school
                      </v-icon>
                      <span class="font-weight-medium">{{ item.name }}</span>
                    </div>
                  </template>

                  <template #item.status="{ item }">
                    <v-chip
                      :color="getTrainingStatusColor(item.status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ item.status }}
                    </v-chip>
                  </template>

                  <template #item.progress="{ item }">
                    <v-progress-linear
                      :model-value="item.progress"
                      color="primary"
                      height="8"
                      rounded
                    />
                    <span class="text-caption">{{ item.progress }}%</span>
                  </template>

                  <template #item.actions="{ item }">
                    <div class="d-flex gap-1">
                      <v-btn
                        icon="mdi-eye"
                        size="small"
                        variant="text"
                        color="primary"
                        @click="() => viewTraining(item)"
                      />
                      <v-btn
                        v-if="item.status === 'running'"
                        icon="mdi-stop"
                        size="small"
                        variant="text"
                        color="error"
                        @click="() => stopTraining(item)"
                      />
                    </div>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-tabs-window-item>

          <!-- Deployments Tab -->
          <v-tabs-window-item value="deployments">
            <v-card class="bg-white">
              <v-card-title class="d-flex justify-space-between align-center">
                <div class="d-flex align-center">
                  <v-icon start color="primary">
                    mdi-rocket-launch
                  </v-icon>
                  Deployments
                </div>
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  :loading="loadingDeployments"
                  @click="refreshDeployments"
                >
                  Refresh
                </v-btn>
              </v-card-title>
              <v-card-text>
                <v-data-table
                  :headers="deploymentHeaders"
                  :items="deployments"
                  :loading="loadingDeployments"
                  class="elevation-0 deployments-table"
                  :items-per-page="10"
                  :items-per-page-options="[5, 10, 25, 50]"
                >
                  <template #item.name="{ item }">
                    <div class="d-flex align-center">
                      <v-icon class="me-2" color="primary">
                        mdi-rocket-launch
                      </v-icon>
                      <span class="font-weight-medium">{{ item.name }}</span>
                    </div>
                  </template>

                  <template #item.status="{ item }">
                    <v-chip
                      :color="getDeploymentStatusColor(item.status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ item.status }}
                    </v-chip>
                  </template>

                  <template #item.actions="{ item }">
                    <div class="d-flex gap-1">
                      <v-btn
                        icon="mdi-eye"
                        size="small"
                        variant="text"
                        color="primary"
                        @click="() => viewDeployment(item)"
                      />
                      <v-btn
                        v-if="item.status === 'active'"
                        icon="mdi-stop"
                        size="small"
                        variant="text"
                        color="error"
                        @click="() => stopDeployment(item)"
                      />
                      <v-btn
                        v-else
                        icon="mdi-play"
                        size="small"
                        variant="text"
                        color="success"
                        @click="() => startDeployment(item)"
                      />
                    </div>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-tabs-window-item>
        </v-tabs-window>
      </template>

      <template #sidebar>
        <LLMGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const router = useRouter()

const navigateToPage = (path: string) => {
  router.push(path)
}

const navigateToModels = () => navigateToPage('/llm/models')
const navigateToTraining = () => navigateToPage('/llm/training')
const navigateToDatasets = () => navigateToPage('/llm/datasets')
const navigateToAnalytics = () => navigateToPage('/llm/analytics')

const activeTab = ref('models')
const loadingModels = ref(false)
const loadingTraining = ref(false)
const loadingDeployments = ref(false)

// Mock data - replace with actual API calls
const models = ref([
  { id: '1', name: 'GPT-4 Fine-tuned', status: 'ready', type: 'text-generation' },
  { id: '2', name: 'BERT Classification', status: 'training', type: 'text-classification' }
])

const trainingSessions = ref([
  { id: '1', name: 'GPT-4 Training', status: 'running', progress: 75 },
  { id: '2', name: 'BERT Training', status: 'completed', progress: 100 }
])

const deployments = ref([
  { id: '1', name: 'GPT-4 API', status: 'active', endpoint: '/api/gpt4' },
  { id: '2', name: 'BERT API', status: 'inactive', endpoint: '/api/bert' }
])

const trainingStats = computed(() => ({
  completed: trainingSessions.value.filter(t => t.status === 'completed').length,
  running: trainingSessions.value.filter(t => t.status === 'running').length
}))

const deploymentStats = computed(() => ({
  active: deployments.value.filter(d => d.status === 'active').length
}))

const modelHeaders = [
  { title: 'Model', key: 'name' },
  { title: 'Status', key: 'status' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const trainingHeaders = [
  { title: 'Session', key: 'name' },
  { title: 'Status', key: 'status' },
  { title: 'Progress', key: 'progress' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const deploymentHeaders = [
  { title: 'Deployment', key: 'name' },
  { title: 'Status', key: 'status' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success'
    case 'training': return 'warning'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const getTrainingStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'info'
    case 'failed': return 'error'
    default: return 'grey'
  }
}

const getDeploymentStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'inactive': return 'grey'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const switchToModelsTab = () => {
  activeTab.value = 'models'
}

const refreshModels = () => {
  loadingModels.value = true
  setTimeout(() => {
    loadingModels.value = false
  }, 1000)
}

const refreshTraining = () => {
  loadingTraining.value = true
  setTimeout(() => {
    loadingTraining.value = false
  }, 1000)
}

const refreshDeployments = () => {
  loadingDeployments.value = true
  setTimeout(() => {
    loadingDeployments.value = false
  }, 1000)
}

const viewModel = (model: any) => {
  // TODO: Implement model viewing functionality
}

const editModel = (model: any) => {
  // TODO: Implement model editing functionality
}

const deployModel = (model: any) => {
  // TODO: Implement model deployment functionality
}

const viewTraining = (session: any) => {
  // TODO: Implement training session viewing functionality
}

const stopTraining = (session: any) => {
  // TODO: Implement training session stopping functionality
}

const viewDeployment = (deployment: any) => {
  // TODO: Implement deployment viewing functionality
}

const stopDeployment = (deployment: any) => {
  // TODO: Implement deployment stopping functionality
}

const startDeployment = (deployment: any) => {
  // TODO: Implement deployment starting functionality
}

onMounted(() => {
  // Load initial data
})
</script>

<style scoped>
.quick-actions-header {
  margin-bottom: 1.5rem;
}

.quick-actions-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

.action-btn {
  min-height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stats-card {
  transition: transform 0.2s ease-in-out;
  cursor: pointer;
}

.stats-card:hover {
  transform: translateY(-4px);
}

.gap-1 {
  gap: 0.25rem;
}

@media (max-width: 768px) {
  .quick-actions-buttons {
    grid-template-columns: 1fr;
  }
  
  .action-btn {
    width: 100%;
  }
}

/* Ensure all text is black for visibility */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.text-body-2) {
  color: black !important;
}

:deep(.text-caption) {
  color: rgba(0, 0, 0, 0.7) !important;
}

:deep(.text-medium-emphasis) {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Ensure tabs are black */
:deep(.v-tab) {
  color: black !important;
}

:deep(.v-tab--selected) {
  color: black !important;
}

/* Ensure data table text is black */
:deep(.v-data-table) {
  color: black !important;
}

:deep(.v-data-table th) {
  color: black !important;
}

:deep(.v-data-table td) {
  color: black !important;
}

:deep(.v-data-table-header) {
  color: black !important;
}

/* Ensure chips are visible */
:deep(.v-chip) {
  color: black !important;
}

/* Ensure buttons are visible */
:deep(.v-btn) {
  color: black !important;
}

/* Ensure progress bars are visible */
:deep(.v-progress-linear) {
  color: black !important;
}

/* Ensure icons are visible */
:deep(.v-icon) {
  color: inherit !important;
}

/* Ensure all text elements are black */
:deep(.font-weight-medium) {
  color: black !important;
}

:deep(.text-h4) {
  color: black !important;
}

:deep(.text-h6) {
  color: black !important;
}

/* Ensure stats cards text is black */
:deep(.stats-card .v-card-text) {
  color: black !important;
}

:deep(.stats-card .text-h4) {
  color: black !important;
}

:deep(.stats-card .text-body-2) {
  color: black !important;
}

:deep(.stats-card .text-caption) {
  color: rgba(0, 0, 0, 0.7) !important;
}
</style>
