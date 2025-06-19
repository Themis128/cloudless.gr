<template>
  <v-card class="ma-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-cloud-check</v-icon>
      Deployment Status
    </v-card-title>

    <v-card-text>
      <div v-if="!deployments || deployments.length === 0">
        <v-alert type="info" variant="tonal">
          No deployments found. Deploy a model to see deployments here.
        </v-alert>
      </div>

      <div v-else>
        <v-row>
          <v-col v-for="deployment in deployments" :key="deployment.id" cols="12" md="6" lg="4">
            <v-card
              :class="['deployment-card', `deployment-card--${deployment.status}`]"
              variant="outlined"
            >
              <v-card-title class="d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <v-avatar :color="getStatusColor(deployment.status)" size="32" class="me-2">
                    <v-icon :icon="getStatusIcon(deployment.status)" color="white" />
                  </v-avatar>
                  <div>
                    <div class="text-h6">{{ deployment.deployment_name }}</div>
                    <div class="text-caption text-medium-emphasis">
                      {{ deployment.environment }}
                    </div>
                  </div>
                </div>

                <v-menu>
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      size="small"
                      variant="text"
                      v-bind="menuProps"
                    />
                  </template>
                  <v-list>
                    <v-list-item @click="viewDetails(deployment)">
                      <v-list-item-title>
                        <v-icon class="me-2">mdi-eye</v-icon>
                        View Details
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item
                      v-if="deployment.endpoint_url"
                      :href="deployment.endpoint_url"
                      target="_blank"
                    >
                      <v-list-item-title>
                        <v-icon class="me-2">mdi-open-in-new</v-icon>
                        Open Endpoint
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="viewLogs(deployment)">
                      <v-list-item-title>
                        <v-icon class="me-2">mdi-text-box</v-icon>
                        View Logs
                      </v-list-item-title>
                    </v-list-item>
                    <v-divider />
                    <v-list-item
                      v-if="deployment.status === 'active'"
                      @click="stopDeployment(deployment)"
                    >
                      <v-list-item-title class="text-warning">
                        <v-icon class="me-2">mdi-stop</v-icon>
                        Stop Deployment
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item
                      v-else-if="deployment.status === 'inactive'"
                      @click="startDeployment(deployment)"
                    >
                      <v-list-item-title class="text-success">
                        <v-icon class="me-2">mdi-play</v-icon>
                        Start Deployment
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="deleteDeployment(deployment)">
                      <v-list-item-title class="text-error">
                        <v-icon class="me-2">mdi-delete</v-icon>
                        Delete Deployment
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </v-card-title>

              <v-card-text>
                <div class="mb-3">
                  <v-chip
                    :color="getStatusColor(deployment.status)"
                    :prepend-icon="getStatusIcon(deployment.status)"
                    variant="flat"
                    size="small"
                    class="mb-2"
                  >
                    {{ deployment.status.toUpperCase() }}
                  </v-chip>
                </div>

                <div class="deployment-info">
                  <div class="info-row">
                    <v-icon size="16" class="me-2">mdi-server</v-icon>
                    <span class="text-body-2">{{ deployment.instance_type }}</span>
                  </div>

                  <div class="info-row">
                    <v-icon size="16" class="me-2">mdi-memory</v-icon>
                    <span class="text-body-2">{{ deployment.memory_limit }}GB RAM</span>
                  </div>

                  <div class="info-row">
                    <v-icon size="16" class="me-2">mdi-cpu-64-bit</v-icon>
                    <span class="text-body-2">{{ deployment.cpu_limit }} CPU</span>
                  </div>

                  <div v-if="deployment.endpoint_url" class="info-row">
                    <v-icon size="16" class="me-2">mdi-link</v-icon>
                    <a
                      :href="deployment.endpoint_url"
                      target="_blank"
                      class="text-primary text-decoration-none text-body-2"
                    >
                      {{ formatUrl(deployment.endpoint_url) }}
                    </a>
                  </div>

                  <div class="info-row">
                    <v-icon size="16" class="me-2">mdi-clock</v-icon>
                    <span class="text-body-2">{{ formatDate(deployment.created_at) }}</span>
                  </div>
                </div>

                <!-- Health Status -->
                <div v-if="deployment.health_status" class="mt-3">
                  <div class="d-flex align-center mb-2">
                    <v-icon size="16" class="me-2">mdi-heart-pulse</v-icon>
                    <span class="text-body-2 font-weight-medium">Health Status</span>
                  </div>
                  <v-progress-linear
                    :model-value="deployment.health_status.uptime_percentage"
                    :color="getHealthColor(deployment.health_status.uptime_percentage)"
                    height="8"
                    class="mb-1"
                  />
                  <div class="text-caption text-medium-emphasis">
                    {{ deployment.health_status.uptime_percentage }}% uptime
                  </div>
                </div>

                <!-- Metrics -->
                <div v-if="deployment.metrics" class="mt-3">
                  <div class="metrics-grid">
                    <div class="metric-item">
                      <div class="text-caption text-medium-emphasis">Requests/min</div>
                      <div class="text-body-2 font-weight-medium">
                        {{ deployment.metrics.requests_per_minute ?? 'N/A' }}
                      </div>
                    </div>
                    <div class="metric-item">
                      <div class="text-caption text-medium-emphasis">Avg Response</div>
                      <div class="text-body-2 font-weight-medium">
                        {{ deployment.metrics.avg_response_time ?? 'N/A' }}ms
                      </div>
                    </div>
                    <div class="metric-item">
                      <div class="text-caption text-medium-emphasis">Error Rate</div>
                      <div class="text-body-2 font-weight-medium">
                        {{ deployment.metrics.error_rate ?? 'N/A' }}%
                      </div>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card-text>

    <!-- Deployment Details Dialog -->
    <v-dialog v-model="detailsDialog" max-width="800">
      <v-card v-if="selectedDeployment">
        <v-card-title> {{ selectedDeployment.deployment_name }} Details </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <div class="text-h6 mb-2">Configuration</div>
              <div class="text-body-2 mb-1">
                <strong>Environment:</strong> {{ selectedDeployment.environment }}
              </div>
              <div class="text-body-2 mb-1">
                <strong>Instance Type:</strong> {{ selectedDeployment.instance_type }}
              </div>
              <div class="text-body-2 mb-1">
                <strong>CPU Limit:</strong> {{ selectedDeployment.cpu_limit }} cores
              </div>
              <div class="text-body-2 mb-1">
                <strong>Memory Limit:</strong> {{ selectedDeployment.memory_limit }}GB
              </div>
              <div class="text-body-2 mb-1">
                <strong>Auto Scaling:</strong>
                {{ selectedDeployment.auto_scaling ? 'Enabled' : 'Disabled' }}
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div class="text-h6 mb-2">Status</div>
              <div class="text-body-2 mb-1">
                <strong>Status:</strong> {{ selectedDeployment.status }}
              </div>
              <div class="text-body-2 mb-1">
                <strong>Created:</strong> {{ formatDate(selectedDeployment.created_at) }}
              </div>
              <div class="text-body-2 mb-1">
                <strong>Last Updated:</strong> {{ formatDate(selectedDeployment.updated_at) }}
              </div>
              <div v-if="selectedDeployment.endpoint_url" class="text-body-2 mb-1">
                <strong>Endpoint:</strong>
                <a :href="selectedDeployment.endpoint_url" target="_blank" class="text-primary">
                  {{ selectedDeployment.endpoint_url }}
                </a>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface DeploymentMetrics {
  requests_per_minute?: number;
  avg_response_time?: number;
  error_rate?: number;
}

interface HealthStatus {
  uptime_percentage: number;
  last_check: string;
}

interface Deployment {
  id: string;
  deployment_name: string;
  environment: string;
  status: string;
  instance_type: string;
  cpu_limit: number;
  memory_limit: number;
  auto_scaling: boolean;
  endpoint_url?: string;
  created_at: string;
  updated_at: string;
  metrics?: DeploymentMetrics;
  health_status?: HealthStatus;
}

const props = defineProps<{
  deployments: Deployment[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  viewDetails: [deployment: Deployment];
  viewLogs: [deployment: Deployment];
  startDeployment: [deployment: Deployment];
  stopDeployment: [deployment: Deployment];
  deleteDeployment: [deployment: Deployment];
}>();

const detailsDialog = ref(false);
const selectedDeployment = ref<Deployment | null>(null);

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return 'success';
    case 'deploying':
      return 'primary';
    case 'inactive':
      return 'warning';
    case 'failed':
      return 'error';
    case 'terminated':
      return 'grey';
    default:
      return 'grey';
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return 'mdi-check-circle';
    case 'deploying':
      return 'mdi-rocket-launch';
    case 'inactive':
      return 'mdi-pause-circle';
    case 'failed':
      return 'mdi-alert-circle';
    case 'terminated':
      return 'mdi-stop-circle';
    default:
      return 'mdi-help-circle';
  }
}

function getHealthColor(percentage: number) {
  if (percentage >= 95) return 'success';
  if (percentage >= 85) return 'warning';
  return 'error';
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function formatUrl(url: string) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

function viewDetails(deployment: Deployment) {
  selectedDeployment.value = deployment;
  detailsDialog.value = true;
  emit('viewDetails', deployment);
}

function viewLogs(deployment: Deployment) {
  emit('viewLogs', deployment);
}

function startDeployment(deployment: Deployment) {
  emit('startDeployment', deployment);
}

function stopDeployment(deployment: Deployment) {
  emit('stopDeployment', deployment);
}

function deleteDeployment(deployment: Deployment) {
  emit('deleteDeployment', deployment);
}
</script>

<style scoped>
.v-card {
  border-radius: 12px;
  /* Glassmorphism styling for starry background */
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.v-card-title {
  background: linear-gradient(45deg, rgba(25, 118, 210, 0.9), rgba(66, 165, 245, 0.9));
  color: white;
  border-radius: 12px 12px 0 0;
}

/* White text for card content on glassmorphism background */
.v-card :deep(.v-card-text),
.v-card :deep(.v-alert),
.deployment-card :deep(.v-card-title),
.deployment-card :deep(.v-card-text),
.deployment-card .text-h6,
.deployment-card .text-caption,
.deployment-card .info-row {
  color: rgba(255, 255, 255, 0.95) !important;
}

.deployment-card .text-caption {
  color: rgba(255, 255, 255, 0.75) !important;
}

.deployment-card {
  transition: all 0.2s ease-in-out;
  height: 100%;
  /* Glassmorphism styling for nested cards */
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.deployment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.08) !important;
}

.deployment-card--active {
  border-left: 4px solid rgb(var(--v-theme-success));
}

.deployment-card--deploying {
  border-left: 4px solid rgb(var(--v-theme-primary));
}

.deployment-card--inactive {
  border-left: 4px solid rgb(var(--v-theme-warning));
}

.deployment-card--failed {
  border-left: 4px solid rgb(var(--v-theme-error));
}

.deployment-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.metric-item {
  text-align: center;
  padding: 8px;
  border-radius: 8px;
  background: rgba(var(--v-theme-surface-variant), 0.5);
}
</style>
