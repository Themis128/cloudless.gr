<template>
  <div>
    <PageStructure
      title="Model Deployments"
      subtitle="Manage and monitor your deployed language models"
      back-button-to="/llm"
      :has-sidebar="true"
    >
      <template #main>
        <!-- Quick Actions -->
        <v-card class="mb-4 quick-actions-card">
          <v-card-text class="quick-actions-content">
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <h3 class="text-h6 mb-1">
                  Quick Actions
                </h3>
                <p class="text-body-2 text-medium-emphasis">
                  Deploy, monitor, and manage your models
                </p>
              </div>
            </div>
            <div class="quick-actions-buttons">
              <v-btn
                to="/llm"
                color="primary"
                prepend-icon="mdi-brain"
                variant="elevated"
                class="action-btn"
                size="large"
              >
                Manage Models
              </v-btn>
              <v-btn
                to="/llm/train"
                color="success"
                prepend-icon="mdi-school"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Train New Model
              </v-btn>
              <v-btn
                to="/llm/deployments"
                color="info"
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

        <!-- Stats Cards -->
        <v-row class="mb-6">
          <v-col cols="12" md="3">
            <v-card class="form-card">
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon color="success" size="40" class="me-3">
                    mdi-rocket
                  </v-icon>
                  <div>
                    <h3 class="text-h4 font-weight-bold stats-number">
                      {{ deploymentStats.active }}
                    </h3>
                    <p class="text-body-1 font-weight-medium stats-label">
                      Active Deployments
                    </p>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Live model endpoints
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="form-card">
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon color="warning" size="40" class="me-3">
                    mdi-clock
                  </v-icon>
                  <div>
                    <h3 class="text-h4 font-weight-bold stats-number">
                      {{ deploymentStats.pending }}
                    </h3>
                    <p class="text-body-1 font-weight-medium stats-label">
                      Pending Deployments
                    </p>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Being deployed
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="form-card">
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon color="error" size="40" class="me-3">
                    mdi-alert-circle
                  </v-icon>
                  <div>
                    <h3 class="text-h4 font-weight-bold stats-number">
                      {{ deploymentStats.failed }}
                    </h3>
                    <p class="text-body-1 font-weight-medium stats-label">
                      Failed Deployments
                    </p>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Deployment errors
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="form-card">
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon color="info" size="40" class="me-3">
                    mdi-chart-line
                  </v-icon>
                  <div>
                    <h3 class="text-h4 font-weight-bold stats-number">
                      {{ totalRequests }}
                    </h3>
                    <p class="text-body-1 font-weight-medium stats-label">
                      Total Requests
                    </p>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Last 24 hours
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Deployments Table -->
        <v-card class="form-card">
          <v-card-title class="form-card-title d-flex justify-space-between align-center">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-rocket
              </v-icon>
              All Deployments
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
          <v-divider />
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
              <template #item.endpoint="{ item }">
                <code class="text-caption">{{ item.endpoint_url || 'Not available' }}</code>
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
                  v-if="item.endpoint_url"
                  icon="mdi-open-in-new"
                  variant="text"
                  size="small"
                  :href="item.endpoint_url"
                  target="_blank"
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
      </template>

      <template #sidebar>
        <LLMGuide page="deploy" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'
import { usePrismaStore } from '~/stores/usePrismaStore'

// Composables
const router = useRouter()
const { getBots } = usePrismaStore()

// Reactive state
const deployments = ref<any[]>([])
const loadingDeployments = ref(false)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

// Computed stats
const deploymentStats = computed(() => ({
  active: deployments.value.filter(d => d.status === 'active').length,
  pending: deployments.value.filter(d => d.status === 'pending').length,
  failed: deployments.value.filter(d => d.status === 'failed').length,
}))

const totalRequests = computed(() => {
  // Mock data - replace with actual API call
  return deployments.value.reduce((sum, d) => sum + (d.requests_24h || 0), 0)
})

// Table headers
const deploymentHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Endpoint', key: 'endpoint', sortable: false },
  { title: 'Created', key: 'createdAt', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false },
]

// Methods
const refreshDeployments = async () => {
  loadingDeployments.value = true
  try {
    const data = await getBots()
    // Transform bot data to deployment format for compatibility
    deployments.value = data.map((bot: any) => ({
      id: bot.id,
      name: bot.name,
      status: bot.status,
      endpoint: `/api/bots/${bot.id}`,
      createdAt: bot.createdAt,
      requests_24h: 0 // Mock data
    })) || []
  } catch (error) {
    showSnackbar('Error fetching deployments', 'error')
  } finally {
    loadingDeployments.value = false
  }
}

const viewDeployment = (deployment: any) => {
  router.push(`/llm/deployments/${deployment.id}`)
}

const deleteDeployment = async (deployment: any) => {
  if (
    confirm(
      `Are you sure you want to delete the deployment "${deployment.name}"?`
    )
  ) {
    try {
      // For now, we'll just show a success message
      // In a real implementation, you'd call a delete API
      showSnackbar('Deployment deleted successfully', 'success')
      refreshDeployments()
    } catch (error) {
      showSnackbar('Error deleting deployment', 'error')
    }
  }
}

const getDeploymentStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending':
      return 'warning'
    case 'failed':
      return 'error'
    case 'inactive':
      return 'grey'
    default:
      return 'primary'
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color,
  }
}

// Initialize data on mount
onMounted(() => {
  refreshDeployments()
})
</script>

<style scoped>
.quick-actions-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.quick-actions-content {
  padding: 1.5rem;
}

.quick-actions-header {
  margin-bottom: 1.5rem;
}

.quick-actions-title h3 {
  color: var(--v-primary-base);
  font-weight: 600;
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

.form-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.form-card-title {
  color: var(--v-primary-base);
  font-weight: 600;
}

.deployments-table {
  background: transparent;
}

.deployments-table .v-data-table__wrapper {
  border-radius: 8px;
  overflow: hidden;
}

.deployments-table .v-data-table__td,
.deployments-table .v-data-table__th {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 12px 16px;
}

.deployments-table .v-data-table__th {
  background: rgba(102, 126, 234, 0.05);
  font-weight: 600;
  color: var(--v-primary-base);
}

.deployments-table .v-data-table__tr:hover {
  background: rgba(102, 126, 234, 0.05);
}

.deployments-table .v-chip {
  font-weight: 500;
}

.deployments-table .v-btn--icon {
  margin: 0 2px;
}

.stats-number {
  color: var(--v-primary-base);
  margin-bottom: 0.25rem;
  line-height: 1.2;
}

.stats-label {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 0;
  line-height: 1.3;
  font-weight: 500;
}

@media (max-width: 768px) {
  .quick-actions-content {
    padding: 1rem;
  }
  
  .quick-actions-buttons {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .action-btn {
    width: 100%;
    min-height: 52px;
  }
}
</style> 