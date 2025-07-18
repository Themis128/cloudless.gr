<template>
  <v-container>
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h4 mb-2">
          LLM Management
        </h1>
        <p class="text-body-1 text-medium-emphasis">
          Manage your language models, training sessions, and deployments
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="$router.push('/llm/train')"
      >
        Start Training
      </v-btn>
    </div>

    <!-- Stats Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon color="primary" size="40" class="me-3">
                mdi-brain
              </v-icon>
              <div>
                <h3 class="text-h5">
                  {{ models.length }}
                </h3>
                <p class="text-body-2 text-medium-emphasis">
                  Active Models
                </p>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon color="success" size="40" class="me-3">
                mdi-school
              </v-icon>
              <div>
                <h3 class="text-h5">
                  {{ trainingStats.completed }}
                </h3>
                <p class="text-body-2 text-medium-emphasis">
                  Completed Training
                </p>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon color="warning" size="40" class="me-3">
                mdi-cog
              </v-icon>
              <div>
                <h3 class="text-h5">
                  {{ trainingStats.running }}
                </h3>
                <p class="text-body-2 text-medium-emphasis">
                  Training in Progress
                </p>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon color="info" size="40" class="me-3">
                mdi-rocket
              </v-icon>
              <div>
                <h3 class="text-h5">
                  {{ deploymentStats.active }}
                </h3>
                <p class="text-body-2 text-medium-emphasis">
                  Active Deployments
                </p>
              </div>
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
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Available Models</span>
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
          <v-divider />
          <v-card-text>
            <v-data-table
              :headers="modelHeaders"
              :items="models"
              :loading="loadingModels"
              class="elevation-0"
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
                  variant="flat"
                >
                  {{ item.status }}
                </v-chip>
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
              <template #item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  variant="text"
                  size="small"
                  @click="() => viewModel(item)"
                />
                <v-btn
                  icon="mdi-rocket"
                  variant="text"
                  size="small"
                  :disabled="item.status !== 'ready'"
                  @click="() => deployModel(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="() => deleteModel(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>

      <!-- Training Sessions Tab -->
      <v-tabs-window-item value="training">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Training Sessions</span>
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-refresh"
              :loading="loadingTraining"
              @click="refreshTrainingSessions"
            >
              Refresh
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-data-table
              :headers="trainingHeaders"
              :items="trainingSessions"
              :loading="loadingTraining"
              class="elevation-0"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon class="me-2" color="success">
                    mdi-school
                  </v-icon>
                  <span class="font-weight-medium">{{ item.name }}</span>
                </div>
              </template>
              <template #item.status="{ item }">
                <v-chip
                  :color="getTrainingStatusColor(item.status)"
                  size="small"
                  variant="flat"
                >
                  {{ item.status }}
                </v-chip>
              </template>
              <template #item.progress="{ item }">
                <div class="d-flex align-center">
                  <v-progress-linear
                    :model-value="item.progress"
                    height="6"
                    :color="item.status === 'completed' ? 'success' : 'primary'"
                    class="me-2"
                    style="min-width: 100px"
                  />
                  <span class="text-caption">{{ item.progress }}%</span>
                </div>
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
              <template #item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  variant="text"
                  size="small"
                  @click="() => viewTrainingSession(item)"
                />
                <v-btn
                  v-if="item.status === 'running'"
                  icon="mdi-stop"
                  variant="text"
                  size="small"
                  color="warning"
                  @click="() => stopTraining(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="() => deleteTrainingSession(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>

      <!-- Deployments Tab -->
      <v-tabs-window-item value="deployments">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Model Deployments</span>
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
          <v-divider />
          <v-card-text>
            <v-data-table
              :headers="deploymentHeaders"
              :items="deployments"
              :loading="loadingDeployments"
              class="elevation-0"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon class="me-2" color="info">
                    mdi-rocket
                  </v-icon>
                  <span class="font-weight-medium">{{ item.name }}</span>
                </div>
              </template>
              <template #item.status="{ item }">
                <v-chip
                  :color="getDeploymentStatusColor(item.status)"
                  size="small"
                  variant="flat"
                >
                  {{ item.status }}
                </v-chip>
              </template>
              <template #item.endpoint_url="{ item }">
                <v-btn
                  v-if="item.endpoint_url"
                  variant="text"
                  size="small"
                  @click="() => copyEndpoint(item.endpoint_url)"
                >
                  {{ item.endpoint_url }}
                </v-btn>
                <span v-else class="text-medium-emphasis">-</span>
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
              <template #item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  variant="text"
                  size="small"
                  @click="() => viewDeployment(item)"
                />
                <v-btn
                  v-if="item.status === 'active'"
                  icon="mdi-stop"
                  variant="text"
                  size="small"
                  color="warning"
                  @click="() => stopDeployment(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="() => deleteDeployment(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- Model Details Dialog -->
    <v-dialog v-model="modelDialog" max-width="600">
      <v-card v-if="selectedModel">
        <v-card-title>{{ selectedModel.name }}</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip :color="getStatusColor(selectedModel.status)" size="small">
                  {{ selectedModel.status }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Created</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(selectedModel.created_at) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Type</v-list-item-title>
              <v-list-item-subtitle>{{ selectedModel.type || 'Custom' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="modelDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '~/composables/supabase'
import { useModelStore } from '~/stores/modelStore'

// Composables
const router = useRouter()
const supabase = useSupabase()
const modelStore = useModelStore()

// Reactive state
const activeTab = ref('models')
const models = ref<any[]>([])
const trainingSessions = ref<any[]>([])
const deployments = ref<any[]>([])
const loadingModels = ref(false)
const loadingTraining = ref(false)
const loadingDeployments = ref(false)
const modelDialog = ref(false)
const selectedModel = ref<any>(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// Computed stats
const trainingStats = computed(() => ({
  completed: trainingSessions.value.filter(s => s.status === 'completed').length,
  running: trainingSessions.value.filter(s => s.status === 'running').length,
  failed: trainingSessions.value.filter(s => s.status === 'failed').length
}))

const deploymentStats = computed(() => ({
  active: deployments.value.filter(d => d.status === 'active').length,
  pending: deployments.value.filter(d => d.status === 'pending').length,
  failed: deployments.value.filter(d => d.status === 'failed').length
}))

// Table headers
const modelHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

const trainingHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Progress', key: 'progress', sortable: true },
  { title: 'Started', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

const deploymentHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Endpoint', key: 'endpoint_url', sortable: false },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Methods
async function refreshModels() {
  loadingModels.value = true
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    models.value = data?.map(model => ({
      ...model,
      status: 'ready' // Default status - you can add a status column to the models table
    })) || []
  } catch (error) {
    console.error('Error fetching models:', error)
    showSnackbar('Error fetching models', 'error')
  } finally {
    loadingModels.value = false
  }
}

async function refreshTrainingSessions() {
  loadingTraining.value = true
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    trainingSessions.value = data?.map(session => ({
      ...session,
      progress: session.status === 'completed' ? 100 : 
                session.status === 'running' ? Math.floor(Math.random() * 80) + 10 : 0
    })) || []
  } catch (error) {
    console.error('Error fetching training sessions:', error)
    showSnackbar('Error fetching training sessions', 'error')
  } finally {
    loadingTraining.value = false
  }
}

async function refreshDeployments() {
  loadingDeployments.value = true
  try {
    const { data, error } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    deployments.value = data || []
  } catch (error) {
    console.error('Error fetching deployments:', error)
    showSnackbar('Error fetching deployments', 'error')
  } finally {
    loadingDeployments.value = false
  }
}

function viewModel(model: any) {
  selectedModel.value = model
  modelDialog.value = true
}

async function deployModel(model: any) {
  try {
    const { error } = await supabase
      .from('deployments')
      .insert({
        name: `${model.name} Deployment`,
        model_version_id: model.id,
        status: 'pending'
      })
    
    if (error) throw error
    
    showSnackbar('Model deployment started', 'success')
    refreshDeployments()
  } catch (error) {
    console.error('Error deploying model:', error)
    showSnackbar('Error deploying model', 'error')
  }
}

async function deleteModel(model: any) {
  if (confirm(`Are you sure you want to delete the model "${model.name}"?`)) {
    try {
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', model.id)
      
      if (error) throw error
      
      showSnackbar('Model deleted successfully', 'success')
      refreshModels()
    } catch (error) {
      console.error('Error deleting model:', error)
      showSnackbar('Error deleting model', 'error')
    }
  }
}

function viewTrainingSession(session: any) {
  // Navigate to training session details
  router.push(`/llm/training/${session.id}`)
}

async function stopTraining(session: any) {
  try {
    const { error } = await supabase
      .from('training_sessions')
      .update({ status: 'stopped' })
      .eq('id', session.id)
    
    if (error) throw error
    
    showSnackbar('Training session stopped', 'success')
    refreshTrainingSessions()
  } catch (error) {
    console.error('Error stopping training:', error)
    showSnackbar('Error stopping training', 'error')
  }
}

async function deleteTrainingSession(session: any) {
  if (confirm(`Are you sure you want to delete the training session "${session.name}"?`)) {
    try {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', session.id)
      
      if (error) throw error
      
      showSnackbar('Training session deleted successfully', 'success')
      refreshTrainingSessions()
    } catch (error) {
      console.error('Error deleting training session:', error)
      showSnackbar('Error deleting training session', 'error')
    }
  }
}

function viewDeployment(deployment: any) {
  // Navigate to deployment details
  router.push(`/llm/deployments/${deployment.id}`)
}

async function stopDeployment(deployment: any) {
  try {
    const { error } = await supabase
      .from('deployments')
      .update({ status: 'inactive' })
      .eq('id', deployment.id)
    
    if (error) throw error
    
    showSnackbar('Deployment stopped', 'success')
    refreshDeployments()
  } catch (error) {
    console.error('Error stopping deployment:', error)
    showSnackbar('Error stopping deployment', 'error')
  }
}

async function deleteDeployment(deployment: any) {
  if (confirm(`Are you sure you want to delete the deployment "${deployment.name}"?`)) {
    try {
      const { error } = await supabase
        .from('deployments')
        .delete()
        .eq('id', deployment.id)
      
      if (error) throw error
      
      showSnackbar('Deployment deleted successfully', 'success')
      refreshDeployments()
    } catch (error) {
      console.error('Error deleting deployment:', error)
      showSnackbar('Error deleting deployment', 'error')
    }
  }
}

function copyEndpoint(url: string) {
  navigator.clipboard.writeText(url)
  showSnackbar('Endpoint URL copied to clipboard', 'success')
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ready': return 'success'
    case 'training': return 'warning'
    case 'error': return 'error'
    default: return 'primary'
  }
}

function getTrainingStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'primary'
    case 'failed': return 'error'
    case 'stopped': return 'warning'
    default: return 'grey'
  }
}

function getDeploymentStatusColor(status: string) {
  switch (status) {
    case 'active': return 'success'
    case 'pending': return 'warning'
    case 'failed': return 'error'
    case 'inactive': return 'grey'
    default: return 'primary'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function showSnackbar(message: string, color: string = 'success') {
  snackbar.value = {
    show: true,
    message,
    color
  }
}

// Initialize data on mount
onMounted(() => {
  refreshModels()
  refreshTrainingSessions()
  refreshDeployments()
})
</script>

<style scoped>
.v-data-table {
  background-color: transparent;
}
</style>
