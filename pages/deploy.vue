<template>
  <div class="deploy-page">
    <v-container>
      <!-- Page Header -->
      <v-row class="mb-6">
        <v-col cols="12">
          <div class="d-flex align-center justify-space-between">
            <div>
              <h1 class="text-h4 font-weight-bold mb-2">Deploy Agents</h1>
              <p class="text-body-1 text-medium-emphasis">
                Deploy your agents to production environments
              </p>
            </div>
            <v-btn
              color="primary"
              size="large"
              prepend-icon="mdi-rocket-launch"
              @click="openDeployDialog"
            >
              New Deployment
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- Deployment Status Cards -->
      <v-row class="mb-6">
        <v-col cols="12" md="3" sm="6">
          <v-card color="success" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-check-circle" size="40" class="me-3" />
                <div>
                  <div class="text-h6 font-weight-bold">{{ deploymentStats.active }}</div>
                  <div class="text-body-2">Active Deployments</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card color="warning" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-clock-outline" size="40" class="me-3" />
                <div>
                  <div class="text-h6 font-weight-bold">{{ deploymentStats.pending }}</div>
                  <div class="text-body-2">Pending</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card color="error" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-alert-circle" size="40" class="me-3" />
                <div>
                  <div class="text-h6 font-weight-bold">{{ deploymentStats.failed }}</div>
                  <div class="text-body-2">Failed</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card color="info" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon icon="mdi-chart-line" size="40" class="me-3" />
                <div>
                  <div class="text-h6 font-weight-bold">{{ deploymentStats.total }}</div>
                  <div class="text-body-2">Total Deployments</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Deployments Table -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center justify-space-between">
              <span>Recent Deployments</span>
              <v-btn-group variant="outlined" size="small">
                <v-btn @click="refreshDeployments" icon="mdi-refresh" />
                <v-btn @click="filterDeployments" icon="mdi-filter" />
              </v-btn-group>
            </v-card-title>

            <v-data-table
              :headers="deploymentHeaders"
              :items="deployments"
              :loading="loading"
              item-key="id"
              class="elevation-0"
            >              <template v-slot:[`item.status`]="{ item }">
                <v-chip
                  :color="getStatusColor(item.status)"
                  size="small"
                  variant="tonal"
                >
                  {{ item.status }}
                </v-chip>
              </template>

              <template v-slot:[`item.agent`]="{ item }">
                <div class="d-flex align-center">
                  <v-avatar size="32" class="me-2">
                    <v-icon :icon="getAgentIcon(item.agent.type)" />
                  </v-avatar>
                  <div>
                    <div class="font-weight-medium">{{ item.agent.name }}</div>
                    <div class="text-caption text-medium-emphasis">{{ item.agent.type }}</div>
                  </div>
                </div>
              </template>

              <template v-slot:[`item.environment`]="{ item }">
                <v-chip
                  :color="getEnvironmentColor(item.environment)"
                  size="small"
                  variant="outlined"
                >
                  {{ item.environment }}
                </v-chip>
              </template>

              <template v-slot:[`item.deployedAt`]="{ item }">
                <div>
                  <div>{{ formatDate(item.deployedAt) }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ formatTime(item.deployedAt) }}
                  </div>
                </div>
              </template>

              <template v-slot:[`item.actions`]="{ item }">
                <v-btn-group variant="text" size="small">
                  <v-btn
                    icon="mdi-eye"
                    @click="viewDeployment(item)"
                    :disabled="item.status === 'failed'"
                  />
                  <v-btn
                    icon="mdi-stop"
                    @click="stopDeployment(item)"
                    :disabled="item.status !== 'active'"
                    color="error"
                  />
                  <v-btn
                    icon="mdi-delete"
                    @click="deleteDeployment(item)"
                    color="error"
                  />
                </v-btn-group>
              </template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Deploy Dialog -->
    <v-dialog v-model="deployDialog" max-width="600">
      <v-card>
        <v-card-title>Deploy New Agent</v-card-title>
        <v-card-text>
          <v-form ref="deployForm" @submit.prevent="deployAgent">
            <v-select
              v-model="deployForm.agentId"
              :items="availableAgents"
              item-title="name"
              item-value="id"
              label="Select Agent"
              required
              class="mb-4"
            />

            <v-select
              v-model="deployForm.environment"
              :items="environments"
              label="Environment"
              required
              class="mb-4"
            />

            <v-text-field
              v-model="deployForm.name"
              label="Deployment Name"
              required
              class="mb-4"
            />

            <v-textarea
              v-model="deployForm.description"
              label="Description"
              rows="3"
              class="mb-4"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deployDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            @click="deployAgent"
            :loading="deploying"
          >
            Deploy
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirmation Dialog -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card>
        <v-card-title>{{ confirmAction.title }}</v-card-title>
        <v-card-text>{{ confirmAction.message }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmDialog = false">Cancel</v-btn>
          <v-btn
            :color="confirmAction.color"
            @click="executeConfirmAction"
            :loading="confirmAction.loading"
          >
            {{ confirmAction.button }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from '#imports'
import { useToast } from '~/composables/useToast'

// Define page meta - deployment features require Business plan
definePageMeta({
  requiresBusiness: true,
  layout: 'default'
})

// Set page title
useHead({
  title: 'Deploy Agents - Cloudless'
})

// Composables
const { showToast } = useToast()

// Reactive data
const loading = ref(false)
const deploying = ref(false)
const deployDialog = ref(false)
const confirmDialog = ref(false)
const deployForm = ref({
  agentId: '',
  environment: '',
  name: '',
  description: ''
})

const confirmAction = ref({
  title: '',
  message: '',
  button: '',
  color: 'primary',
  loading: false,
  action: null as (() => Promise<void>) | null
})

// Mock data
const deploymentStats = ref({
  active: 12,
  pending: 3,
  failed: 1,
  total: 28
})

const environments = ['development', 'staging', 'production']

const availableAgents = ref([
  { id: 'agent-1', name: 'Data Processor', type: 'data' },
  { id: 'agent-2', name: 'Chat Assistant', type: 'chat' },
  { id: 'agent-3', name: 'Document Analyzer', type: 'analysis' },
  { id: 'agent-4', name: 'Workflow Manager', type: 'workflow' }
])

const deployments = ref([
  {
    id: 'deploy-1',
    agent: { name: 'Chat Assistant', type: 'chat' },
    environment: 'production',
    status: 'active',
    deployedAt: new Date('2025-06-01T10:30:00'),
    url: 'https://chat.cloudless.gr'
  },
  {
    id: 'deploy-2',
    agent: { name: 'Data Processor', type: 'data' },
    environment: 'staging',
    status: 'pending',
    deployedAt: new Date('2025-06-02T09:15:00'),
    url: 'https://staging-data.cloudless.gr'
  },
  {
    id: 'deploy-3',
    agent: { name: 'Document Analyzer', type: 'analysis' },
    environment: 'development',
    status: 'failed',
    deployedAt: new Date('2025-06-01T16:45:00'),
    url: null
  }
])

const deploymentHeaders = [
  { title: 'Agent', key: 'agent', sortable: false },
  { title: 'Environment', key: 'environment' },
  { title: 'Status', key: 'status' },
  { title: 'Deployed At', key: 'deployedAt' },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Methods
const getStatusColor = (status: string) => {
  const colors = {
    active: 'success',
    pending: 'warning',
    failed: 'error',
    stopped: 'default'
  }
  return colors[status as keyof typeof colors] || 'default'
}

const getEnvironmentColor = (environment: string) => {
  const colors = {
    production: 'error',
    staging: 'warning',
    development: 'info'
  }
  return colors[environment as keyof typeof colors] || 'default'
}

const getAgentIcon = (type: string) => {
  const icons = {
    chat: 'mdi-chat',
    data: 'mdi-database',
    analysis: 'mdi-file-document-outline',
    workflow: 'mdi-workflow'
  }
  return icons[type as keyof typeof icons] || 'mdi-robot'
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const openDeployDialog = () => {
  deployForm.value = {
    agentId: '',
    environment: '',
    name: '',
    description: ''
  }
  deployDialog.value = true
}

const deployAgent = async () => {
  deploying.value = true
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))

    const agent = availableAgents.value.find((a: any) => a.id === deployForm.value.agentId)
    const newDeployment = {
      id: `deploy-${Date.now()}`,
      agent: agent!,
      environment: deployForm.value.environment,
      status: 'pending',
      deployedAt: new Date(),
      url: `https://${deployForm.value.environment}-${agent?.name.toLowerCase().replace(' ', '-')}.cloudless.gr`
    }

    deployments.value.unshift(newDeployment)
    deploymentStats.value.pending++
    deploymentStats.value.total++

    showToast('Agent deployment started successfully', 'success')
    deployDialog.value = false  } catch (error) {
    console.error('Deployment start error:', error)
    showToast('Failed to start deployment', 'error')
  } finally {
    deploying.value = false
  }
}

const viewDeployment = (deployment: any) => {
  if (deployment.url) {
    window.open(deployment.url, '_blank')
  }
}

const stopDeployment = (deployment: any) => {
  confirmAction.value = {
    title: 'Stop Deployment',
    message: `Are you sure you want to stop the deployment for ${deployment.agent.name}?`,
    button: 'Stop',
    color: 'error',
    loading: false,
    action: async () => {
      confirmAction.value.loading = true
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        deployment.status = 'stopped'
        deploymentStats.value.active--
        showToast('Deployment stopped successfully', 'success')
        confirmDialog.value = false      } catch (error) {
        console.error('Stop deployment error:', error)
        showToast('Failed to stop deployment', 'error')
      } finally {
        confirmAction.value.loading = false
      }
    }
  }
  confirmDialog.value = true
}

const deleteDeployment = (deployment: any) => {
  confirmAction.value = {
    title: 'Delete Deployment',
    message: `Are you sure you want to delete the deployment for ${deployment.agent.name}? This action cannot be undone.`,
    button: 'Delete',
    color: 'error',
    loading: false,
    action: async () => {
      confirmAction.value.loading = true
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const index = deployments.value.findIndex((d: any) => d.id === deployment.id)
        if (index > -1) {
          deployments.value.splice(index, 1)
          if (deployment.status === 'active') deploymentStats.value.active--
          else if (deployment.status === 'pending') deploymentStats.value.pending--
          else if (deployment.status === 'failed') deploymentStats.value.failed--
          deploymentStats.value.total--
        }
        showToast('Deployment deleted successfully', 'success')
        confirmDialog.value = false      } catch (error) {
        console.error('Delete deployment error:', error)
        showToast('Failed to delete deployment', 'error')
      } finally {
        confirmAction.value.loading = false
      }
    }
  }
  confirmDialog.value = true
}

const executeConfirmAction = () => {
  if (confirmAction.value.action) {
    confirmAction.value.action()
  }
}

const refreshDeployments = async () => {
  loading.value = true
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    showToast('Deployments refreshed', 'success')  } catch (error) {
    console.error('Refresh deployments error:', error)
    showToast('Failed to refresh deployments', 'error')
  } finally {
    loading.value = false
  }
}

const filterDeployments = () => {
  showToast('Filter functionality coming soon', 'info')
}

// Lifecycle
onMounted(() => {
  // Load initial data
})
</script>

<style scoped>
.deploy-page {
  min-height: 100vh;
  background: #fafafa;
}

@media (max-width: 768px) {
  .deploy-page {
    padding: 0 8px;
  }
}
</style>
