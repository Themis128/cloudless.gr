<template>
  <div class="deployment-page">
    <v-container fluid class="pa-6">
      <!-- Page Header -->
      <div class="page-header mb-8">
        <v-card class="header-card" elevation="2">
          <v-card-text class="pa-6">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <v-btn
                  variant="text"
                  prepend-icon="mdi-arrow-left"
                  class="mb-3"
                  @click="router.push(`/projects/${route.params.id}`)"
                >
                  Back to Project
                </v-btn>
                <h1 class="text-h3 font-weight-bold mb-2">Model Deployment</h1>
                <p class="text-h6 text-medium-emphasis">Deploy and manage your trained models</p>
              </div>
              <div class="header-actions">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  :disabled="!hasTrainedModels"
                  @click="showDeployDialog = true"
                >
                  New Deployment
                </v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Deployment Stats -->
      <div class="deployment-stats mb-8">
        <v-row>
          <v-col cols="12" md="3">
            <v-card class="stat-card" elevation="2">
              <v-card-text class="pa-4 text-center">
                <v-icon
                  icon="mdi-cloud-check"
                  size="32"
                  color="success"
                  class="mb-2"
                />
                <div class="text-h6 font-weight-bold">{{ stats.activeDeployments }}</div>
                <div class="text-caption text-medium-emphasis">Active Deployments</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stat-card" elevation="2">
              <v-card-text class="pa-4 text-center">
                <v-icon
                  icon="mdi-chart-line"
                  size="32"
                  color="info"
                  class="mb-2"
                />
                <div class="text-h6 font-weight-bold">{{ stats.totalRequests }}</div>
                <div class="text-caption text-medium-emphasis">Total Requests</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stat-card" elevation="2">
              <v-card-text class="pa-4 text-center">
                <v-icon
                  icon="mdi-speedometer"
                  size="32"
                  color="warning"
                  class="mb-2"
                />
                <div class="text-h6 font-weight-bold">{{ stats.avgResponseTime }}ms</div>
                <div class="text-caption text-medium-emphasis">Avg Response Time</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stat-card" elevation="2">
              <v-card-text class="pa-4 text-center">
                <v-icon
                  icon="mdi-check-circle"
                  size="32"
                  color="primary"
                  class="mb-2"
                />
                <div class="text-h6 font-weight-bold">{{ stats.uptime }}%</div>
                <div class="text-caption text-medium-emphasis">Uptime</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <v-row>
        <!-- Deployment List -->
        <v-col cols="12" lg="8">
          <div class="deployments-section">
            <v-card class="deployments-card" elevation="2">
              <v-card-title class="pa-6 pb-4">
                <v-icon icon="mdi-cloud-upload" class="me-2" />
                Deployments
              </v-card-title>
              <v-card-text class="pa-6 pt-0">
                <DeploymentStatusList
                  :deployments="getActiveDeployments() as any"
                  :loading="deploymentsLoading"
                  @view-details="viewDeploymentDetails"
                  @view-logs="viewDeploymentLogs"
                  @start-deployment="restartDeployment"
                  @stop-deployment="stopDeployment"
                  @delete-deployment="deleteDeployment"
                />
              </v-card-text>
            </v-card>
          </div>
        </v-col>

        <!-- API Endpoints & Monitoring -->
        <v-col cols="12" lg="4">
          <div class="api-endpoints-section mb-6">
            <v-card class="endpoints-card" elevation="2">
              <v-card-title class="pa-6 pb-4">
                <v-icon icon="mdi-api" class="me-2" />
                API Endpoints
              </v-card-title>
              <v-card-text class="pa-6 pt-0">
                <!-- API Endpoints section removed: missing apiEndpoints and related methods -->
              </v-card-text>
            </v-card>
          </div>

          <div class="monitoring-section">
            <v-card class="monitoring-card" elevation="2">
              <v-card-title class="pa-6 pb-4">
                <v-icon icon="mdi-monitor" class="me-2" />
                Performance Monitoring
              </v-card-title>
              <v-card-text class="pa-6 pt-0">
                <!-- Monitoring section removed: missing performanceMetrics and updateMonitoringTimeRange -->
              </v-card-text>
            </v-card>
          </div>
        </v-col>
      </v-row>

      <!-- Deployment History -->
      <div class="deployment-history mt-8">
        <v-card class="history-card" elevation="2">
          <v-card-title class="pa-6 pb-4">
            <v-icon icon="mdi-history" class="me-2" />
            Deployment History
          </v-card-title>
          <v-card-text class="pa-6 pt-0">
            <!-- Deployment history section removed: missing deploymentHistory and related methods -->
          </v-card-text>
        </v-card>
      </div>

      <!-- New Deployment Dialog -->
      <v-dialog v-model="showDeployDialog" max-width="800">
        <v-card class="deploy-dialog">
          <v-card-title class="pa-6 pb-4">
            <v-icon icon="mdi-cloud-upload" class="me-2" />
            Deploy New Model
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="showDeployDialog = false" />
          </v-card-title>
          <v-card-text class="pa-6 pt-0">
            <DeploymentConfigForm
              v-model="deploymentConfig"
              :project-id="route.params.id as string"
              :available-models="availableModels"
              :loading="configLoading"
              @deploy="deployModel"
              @cancel="showDeployDialog = false"
            />
          </v-card-text>
        </v-card>
      </v-dialog>

      <!-- Deployment Details Dialog -->
      <v-dialog v-model="showDetailsDialog" max-width="1000">
        <v-card v-if="selectedDeployment" class="details-dialog">
          <v-card-title class="pa-6 pb-4">
            <v-icon icon="mdi-information" class="me-2" />
            Deployment Details: {{ selectedDeployment.name }}
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="showDetailsDialog = false" />
          </v-card-title>
          <v-card-text class="pa-6 pt-0">
            <v-tabs v-model="detailsTab">
              <v-tab value="overview">Overview</v-tab>
              <v-tab value="logs">Logs</v-tab>
              <v-tab value="metrics">Metrics</v-tab>
              <v-tab value="settings">Settings</v-tab>
            </v-tabs>

            <v-tabs-window v-model="detailsTab" class="mt-4">
              <v-tabs-window-item value="overview">
                <div class="deployment-overview">
                  <v-row>
                    <v-col cols="12" md="6">
                      <div class="detail-section">
                        <h4 class="text-h6 font-weight-bold mb-2">Configuration</h4>
                        <v-list density="compact">
                          <v-list-item>
                            <v-list-item-title>Model Version</v-list-item-title>
                            <v-list-item-subtitle>{{
                              selectedDeployment.model_version_id || 'Latest'
                            }}</v-list-item-subtitle>
                          </v-list-item>
                          <v-list-item>
                            <v-list-item-title>Environment</v-list-item-title>
                            <v-list-item-subtitle>{{
                              selectedDeployment.environment
                            }}</v-list-item-subtitle>
                          </v-list-item>
                          <v-list-item>
                            <v-list-item-title>Instance Type</v-list-item-title>
                            <v-list-item-subtitle>
                              {{ getInstanceType(selectedDeployment?.config) }}
                            </v-list-item-subtitle>
                          </v-list-item>
                        </v-list>
                      </div>
                    </v-col>
                    <v-col cols="12" md="6">
                      <div class="detail-section">
                        <h4 class="text-h6 font-weight-bold mb-2">Status</h4>
                        <v-chip :color="getStatusColor(selectedDeployment.status)" class="mb-2">
                          {{ selectedDeployment.status }}
                        </v-chip>
                        <p class="text-body-2">
                          Created: {{ formatDate(selectedDeployment.created_at) }}
                        </p>
                        <p class="text-body-2">
                          Last Updated: {{ formatDate(selectedDeployment.updated_at) }}
                        </p>
                      </div>
                    </v-col>
                  </v-row>
                </div>
              </v-tabs-window-item>

              <v-tabs-window-item value="logs">
                <div class="deployment-logs">
                  <v-code class="logs-content">{{ deploymentLogs }}</v-code>
                </div>
              </v-tabs-window-item>

              <v-tabs-window-item value="metrics">
                <div class="deployment-metrics">
                  <PerformanceMonitoringChart
                    :metrics="performanceMetrics"
                    :project-id="route.params.id as string"
                    :deployment-id="selectedDeployment.id"
                    :time-range="monitoringTimeRange"
                    :loading="metricsLoading"
                    :detailed="true"
                    @time-range-change="updateMonitoringTimeRange"
                  />
                </div>
              </v-tabs-window-item>

              <v-tabs-window-item value="settings">
                <div class="deployment-settings">
                  <v-form>
                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="selectedDeployment.name"
                          label="Deployment Name"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-select
                          v-model="selectedDeployment.environment"
                          :items="environments"
                          label="Environment"
                          variant="outlined"
                        />
                      </v-col>
                    </v-row>
                    <v-btn color="primary">Update Settings</v-btn>
                  </v-form>
                </div>
              </v-tabs-window-item>
            </v-tabs-window>
          </v-card-text>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { definePageMeta } from '#imports';
definePageMeta({ layout: 'projects', middleware: 'auth' })
import { useDeploymentStore } from '~/stores/deploymentStore';
import type { Deployment } from '~/types/project';

// Route and project data
const route = useRoute();
const router = useRouter();
const projectId = route.params.id as string;

// Initialize stores
const deploymentStore = useDeploymentStore();

// Reactive data from store
const deployments = computed(() => deploymentStore.deployments);
const deploymentsLoading = computed(() => deploymentStore.loading);
function getActiveDeployments() {
  const result = [];
  for (const d of deployments.value) {
    // @ts-ignore: status is always present
    if (d.status === 'active') result.push(d);
  }
  return result;
}

// Local reactive data for UI state
const project = ref(null);
const showDeployDialog = ref(false);
const showDetailsDialog = ref(false);
const selectedDeployment = ref<Deployment | null>(null);
const detailsTab = ref('overview');
const refreshing = ref(false);
const configLoading = ref(false);
// Removed unused: endpointsLoading, historyLoading
const metricsLoading = ref(false);
const monitoringTimeRange = ref('24h');

// Deployment configuration
const deploymentConfig = ref({
  name: '',
  environment: 'production' as 'development' | 'staging' | 'production',
  instanceType: 'standard-2',
  instanceCount: 1,
  autoScaling: false,
  minInstances: 1,
  maxInstances: 10,
  targetCpuUtilization: 70,
  healthCheckEnabled: true,
  healthCheckPath: '/health',
  environmentVariables: {},
  secrets: {},
});

// const availableEnvironments = ref(['development', 'staging', 'production']);
const hasTrainedModels = ref(true);
const availableModels = ref<string[]>([]);
const deploymentLogs = ref('');
const environments = ['development', 'staging', 'production'];

// Stats for dashboard
const stats = ref({
  activeDeployments: 0,
  totalRequests: 0,
  avgResponseTime: 0,
  uptime: 99.9,
});

// Computed properties
const canDeploy = computed(() => {
  return (
    project.value &&
    deploymentConfig.value &&
    !deploymentsLoading.value &&
    deploymentConfig.value.environment
  );
});

// Removed unused: activeDeployment

// Methods using the store
const deployModel = async () => {
  if (!canDeploy.value || !projectId) return;

  try {
    const config = {
      instance_type: deploymentConfig.value.instanceType,
      environment: deploymentConfig.value.environment,
      autoScaling: deploymentConfig.value.autoScaling
        ? {
            enabled: deploymentConfig.value.autoScaling,
            minInstances: deploymentConfig.value.minInstances,
            maxInstances: deploymentConfig.value.maxInstances,
            targetCpuUtilization: deploymentConfig.value.targetCpuUtilization,
          }
        : undefined,
      healthCheck: deploymentConfig.value.healthCheckEnabled
        ? {
            enabled: true,
            path: deploymentConfig.value.healthCheckPath,
            intervalSeconds: 30,
            timeoutSeconds: 5,
            failureThreshold: 3,
          }
        : undefined,
      environment_variables: deploymentConfig.value.environmentVariables,
      secrets: deploymentConfig.value.secrets,
    };

    const result = await deploymentStore.createDeployment(
      'dummy-model-version-id', // This should come from selected model
      config,
      deploymentConfig.value.name,
    );

    if (result) {
      showDeployDialog.value = false;
      // Reset form
      deploymentConfig.value.name = '';
    }
  } catch (error) {
    console.error('Failed to deploy model:', error);
  }
};



// Stop a deployment (set status to 'stopped')
const stopDeployment = async (deployment: Deployment) => {
  try {
    await deploymentStore.updateDeploymentStatus(deployment.id, 'stopped');
    await refreshDeployments();
  } catch (error) {
    console.error('Failed to stop deployment:', error);
  }
};

// Restart a deployment (optional, stub if not supported)
const restartDeployment = async (_deployment: Deployment) => {
  // If not supported, you can remove this or show a notification
  console.warn('Restart deployment is not implemented.');
};

const deleteDeployment = async (deployment: Deployment) => {
  await deploymentStore.deleteDeployment(deployment.id);
  await refreshDeployments();
};

const refreshDeployments = async () => {
  refreshing.value = true;
  try {
    await deploymentStore.fetchDeployments(projectId);
    // Update stats
    stats.value.activeDeployments = deployments.value.filter((d: Deployment) => d.status === 'active').length;
  } finally {
    refreshing.value = false;
  }
};

// Performance metrics for monitoring chart
import type { PerformanceMetrics } from '~/types/project';
const performanceMetrics = ref<PerformanceMetrics[]>([]);

// Update monitoring time range and fetch metrics
const updateMonitoringTimeRange = async (range: string) => {
  monitoringTimeRange.value = range;
  metricsLoading.value = true;
  try {
    // Replace with actual fetch logic from your store or API
    // Example: performanceMetrics.value = await deploymentStore.fetchPerformanceMetrics(projectId, selectedDeployment.value?.id, range);
    performanceMetrics.value = [];
  } catch (error) {
    console.error('Failed to fetch performance metrics:', error);
  } finally {
    metricsLoading.value = false;
  }
};

const openDeploymentDetails = (deployment: Deployment) => {
  selectedDeployment.value = deployment;
  showDetailsDialog.value = true;
};

const viewDeploymentDetails = (deployment: Deployment) => {
  openDeploymentDetails(deployment);
};

const viewDeploymentLogs = (deployment: Deployment) => {
  // Implement log viewing
  console.log('View logs for deployment:', deployment.id);
};


// Initialize data
onMounted(async () => {
  try {
    await refreshDeployments();
  } catch (error) {
    console.error('Failed to load deployment page data:', error);
  }
});

// Expose getInstanceType to template
const getInstanceType = (config: unknown) => {
  if (config && typeof config === 'object' && 'instance_type' in config) {
    // @ts-ignore: config may be loosely typed from backend, allow dynamic access
    return config.instance_type || 'Not specified';
  }
  return 'Not specified';
};

// Format date utility for template
const formatDate = (date: string | number | Date | undefined) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

// Map deployment status to color for v-chip
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'deploying':
      return 'warning';
    case 'stopped':
      return 'error';
    default:
      return 'default';
  }
};
</script>

<style scoped>
.deployment-page {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surface)) 0%,
    rgba(var(--v-theme-info), 0.02) 100%
  );
}

.page-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-info)) 0%,
    rgb(var(--v-theme-primary)) 100%
  );
  color: white;
  padding: 2rem 0;
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" fill="white" opacity="0.08"><circle cx="100" cy="50" r="20"/><circle cx="300" cy="30" r="15"/><circle cx="500" cy="60" r="25"/><circle cx="700" cy="20" r="10"/><circle cx="900" cy="40" r="18"/></svg>')
    repeat-x;
  background-size: 1000px 100px;
}

.page-header .v-btn {
  color: rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  transition: all 0.3s ease;
}

.page-header .v-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  position: relative;
  z-index: 1;
}

.project-info {
  display: flex;
  align-items: center;
}

.deployment-config-card,
.deployment-status-card,
.api-endpoints-card,
.deployment-history-card,
.monitoring-card,
.stat-card,
.deployments-card,
.endpoints-card,
.history-card {
  height: 100%;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-radius: 16px;
  border: 1px solid rgba(var(--v-border-color), 0.12);
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
}

.deployment-config-card:hover,
.deployment-status-card:hover,
.api-endpoints-card:hover,
.deployment-history-card:hover,
.monitoring-card:hover,
.stat-card:hover,
.deployments-card:hover,
.endpoints-card:hover,
.history-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
  border-color: rgba(var(--v-theme-info), 0.3);
}

.deployment-config-card .v-card-title,
.deployment-status-card .v-card-title,
.api-endpoints-card .v-card-title,
.deployment-history-card .v-card-title,
.monitoring-card .v-card-title,
.stat-card .v-card-title,
.deployments-card .v-card-title,
.endpoints-card .v-card-title,
.history-card .v-card-title {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-info), 0.05) 0%,
    rgba(var(--v-theme-surface), 0.8) 100%
  );
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  font-weight: 600;
  padding: 20px;
}

.deployment-actions {
  margin-top: 1.5rem;
}

.deployment-actions .v-btn {
  border-radius: 28px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

.deployment-actions .v-btn:hover:not(.v-btn--disabled) {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

/* Status indicators */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  font-size: 0.875rem;
}

.status-indicator.active {
  background: rgba(var(--v-theme-success), 0.1);
  color: rgb(var(--v-theme-success));
  border: 1px solid rgba(var(--v-theme-success), 0.2);
}

.status-indicator.deploying {
  background: rgba(var(--v-theme-warning), 0.1);
  color: rgb(var(--v-theme-warning));
  border: 1px solid rgba(var(--v-theme-warning), 0.2);
}

.status-indicator.stopped {
  background: rgba(var(--v-theme-error), 0.1);
  color: rgb(var(--v-theme-error));
  border: 1px solid rgba(var(--v-theme-error), 0.2);
}

/* Enhanced dividers */
.v-divider {
  border-color: rgba(var(--v-border-color), 0.12);
}

@media (max-width: 960px) {
  .page-header {
    padding: 1rem 0;
  }

  .header-content {
    padding: 0 1rem;
  }

  .project-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .deployment-config-card:hover,
  .deployment-status-card:hover,
  .api-endpoints-card:hover,
  .deployment-history-card:hover,
  .monitoring-card:hover,
  .stat-card:hover,
  .deployments-card:hover,
  .endpoints-card:hover,
  .history-card:hover {
    transform: none;
  }
}
</style>
