<template>
  <v-container>
    <div class="d-flex align-center mb-6">
      <BackButton to="/llm" />
      <div class="ml-4">
        <h1 class="text-h4 mb-2">
          Deployment Details
        </h1>
        <p class="text-body-1 text-medium-emphasis">
          Monitor and manage your model deployment
        </p>
      </div>
    </div>

    <v-row v-if="deployment">
      <v-col cols="12" md="8">
        <!-- Deployment Status -->
        <v-card class="mb-4">
          <v-card-title>
            <v-icon start color="info">
              mdi-rocket
            </v-icon>
            Deployment Status
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-list>
                  <v-list-item>
                    <v-list-item-title>Name</v-list-item-title>
                    <v-list-item-subtitle>
                      {{
                        deployment.name
                      }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>Status</v-list-item-title>
                    <v-list-item-subtitle>
                      <v-chip
                        :color="getStatusColor(deployment.status)"
                        size="small"
                      >
                        {{ deployment.status }}
                      </v-chip>
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>Created</v-list-item-title>
                    <v-list-item-subtitle>
                      {{
                        formatDate(deployment.created_at)
                      }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-col cols="12" md="6">
                <v-list>
                  <v-list-item>
                    <v-list-item-title>Endpoint URL</v-list-item-title>
                    <v-list-item-subtitle>
                      <div class="d-flex align-center">
                        <span class="text-truncate me-2">{{
                          deployment.endpoint_url || 'Not available'
                        }}</span>
                        <v-btn
                          v-if="deployment.endpoint_url"
                          icon="mdi-content-copy"
                          variant="text"
                          size="small"
                          @click="copyEndpoint"
                        />
                      </div>
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>Model Version</v-list-item-title>
                    <v-list-item-subtitle>
                      {{
                        deployment.model_version_id || 'Unknown'
                      }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>Updated</v-list-item-title>
                    <v-list-item-subtitle>
                      {{
                        formatDate(deployment.updated_at)
                      }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Deployment Configuration -->
        <v-card class="mb-4">
          <v-card-title>Configuration</v-card-title>
          <v-divider />
          <v-card-text>
            <pre class="config-json">{{
              JSON.stringify(deployment.config, null, 2)
            }}</pre>
          </v-card-text>
        </v-card>

        <!-- Deployment Logs -->
        <v-card>
          <v-card-title>Deployment Logs</v-card-title>
          <v-divider />
          <v-card-text>
            <v-textarea
              :model-value="deploymentLogs.join('\n')"
              readonly
              rows="10"
              variant="outlined"
              class="deployment-logs"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <!-- Actions -->
        <v-card class="mb-4">
          <v-card-title>Actions</v-card-title>
          <v-divider />
          <v-card-text>
            <v-btn
              v-if="deployment.status === 'active'"
              color="warning"
              variant="outlined"
              block
              class="mb-2"
              :loading="loading"
              @click="stopDeployment"
            >
              <v-icon start>
                mdi-stop
              </v-icon>
              Stop Deployment
            </v-btn>
            <v-btn
              v-if="deployment.status === 'inactive'"
              color="success"
              variant="outlined"
              block
              class="mb-2"
              :loading="loading"
              @click="startDeployment"
            >
              <v-icon start>
                mdi-play
              </v-icon>
              Start Deployment
            </v-btn>
            <v-btn
              color="error"
              variant="outlined"
              block
              :loading="loading"
              @click="deleteDeployment"
            >
              <v-icon start>
                mdi-delete
              </v-icon>
              Delete Deployment
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- Metrics -->
        <v-card>
          <v-card-title>Metrics</v-card-title>
          <v-divider />
          <v-card-text>
            <v-list>
              <v-list-item>
                <v-list-item-title>Requests (24h)</v-list-item-title>
                <v-list-item-subtitle>
                  {{
                    metrics.requests_24h
                  }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Avg Response Time</v-list-item-title>
                <v-list-item-subtitle>
                  {{ metrics.avg_response_time }}ms
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Error Rate</v-list-item-title>
                <v-list-item-subtitle>
                  {{ metrics.error_rate }}%
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Uptime</v-list-item-title>
                <v-list-item-subtitle>
                  {{ metrics.uptime }}%
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading State -->
    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center">
            <v-progress-circular indeterminate color="primary" />
            <p class="mt-4">
              Loading deployment details...
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="closeSnackbar">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackButton from '~/components/ui/BackButton.vue'
import { usePrismaStore } from '~/stores/usePrismaStore'

const route = useRoute()
const router = useRouter()
const { getBot, updateBot } = usePrismaStore()

const deployment = ref<any>(null)
const loading = ref(false)
const deploymentLogs = ref<string[]>([])
const metrics = ref({
  requests_24h: 1247,
  avg_response_time: 156,
  error_rate: 0.2,
  uptime: 99.8,
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

onMounted(async () => {
  await fetchDeployment()
  await fetchDeploymentLogs()
})

const fetchDeployment = async () => {
  try {
    const data = await getBot(Number(route.params.id))
    deployment.value = data
  } catch (error) {
    showSnackbar('Error loading deployment details', 'error')
  }
}

const fetchDeploymentLogs = async () => {
  // Simulate deployment logs
  deploymentLogs.value = [
    '[2024-01-15 10:30:00] Deployment started',
    '[2024-01-15 10:30:15] Model loaded successfully',
    '[2024-01-15 10:30:30] Health check passed',
    '[2024-01-15 10:30:45] Deployment active',
    '[2024-01-15 10:31:00] First request processed',
    '[2024-01-15 10:31:15] Scaling up to 2 instances',
    '[2024-01-15 10:32:00] Load balancer configured',
    '[2024-01-15 10:32:30] Monitoring enabled',
  ]
}

const stopDeployment = async () => {
  loading.value = true
  try {
    await updateBot(Number(route.params.id), {
      ...deployment.value,
      status: 'inactive',
    })
    deployment.value.status = 'inactive'
    showSnackbar('Deployment stopped successfully', 'success')
  } catch (error) {
    showSnackbar('Error stopping deployment', 'error')
  } finally {
    loading.value = false
  }
}

const startDeployment = async () => {
  loading.value = true
  try {
    await updateBot(Number(route.params.id), {
      ...deployment.value,
      status: 'active',
    })
    deployment.value.status = 'active'
    showSnackbar('Deployment started successfully', 'success')
  } catch (error) {
    showSnackbar('Error starting deployment', 'error')
  } finally {
    loading.value = false
  }
}

const deleteDeployment = async () => {
  if (!confirm('Are you sure you want to delete this deployment?')) return

  loading.value = true
  try {
    // This part of the logic needs to be updated to use Prisma for deletion
    // For now, we'll just show a snackbar and redirect
    showSnackbar('Deployment deletion is not yet implemented with Prisma', 'info')
    // Example of how it would look with Prisma:
    // await supabase
    //   .from('deployments')
    //   .delete()
    //   .eq('id', String(route.params.id))

    // if (error) throw error

    // showSnackbar('Deployment deleted successfully', 'success')
    // router.push('/llm')
  } catch (error) {
    // Error deleting deployment - could be logged to a proper logging service
    // console.error('Error deleting deployment:', error)
    showSnackbar('Error deleting deployment', 'error')
  } finally {
    loading.value = false
  }
}

const copyEndpoint = () => {
  if (deployment.value?.endpoint_url) {
    navigator.clipboard.writeText(deployment.value.endpoint_url)
    showSnackbar('Endpoint URL copied to clipboard', 'success')
  }
}

const getStatusColor = (status: string) => {
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
  if (!dateString) return 'N/A'
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

const closeSnackbar = () => {
  snackbar.value.show = false
}
</script>

<style scoped>
.config-json {
  background: rgba(var(--v-theme-surface-variant), 0.1);
  padding: 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  overflow-x: auto;
}

.deployment-logs {
  font-family: monospace;
  font-size: 12px;
}

.deployment-logs :deep(.v-field__input) {
  font-family: monospace;
  font-size: 12px;
}
</style>
