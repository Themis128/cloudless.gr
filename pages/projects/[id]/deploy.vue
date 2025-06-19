<template>
  <div class="deployment-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="breadcrumb-nav">
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          class="mb-2"
          @click="navigateTo(`/projects/${route.params.id}`)"
        >
          Back to Pipeline
        </v-btn>
      </div>

      <div class="header-content">
        <div class="project-info">
          <v-avatar :color="getProjectColor(project?.type)" size="48" class="me-4">
            <v-icon :icon="getProjectIcon(project?.type)" color="white" />
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">{{ project?.name || 'Loading...' }}</h1>
            <p class="text-body-1 text-medium-emphasis mb-2">Model Deployment & Management</p>
            <v-chip
              v-if="project"
              :color="getStatusColor(project.status)"
              :prepend-icon="getStatusIcon(project.status)"
              size="small"
              variant="tonal"
            >
              {{
                (project.status || 'unknown').charAt(0).toUpperCase() +
                (project.status || 'unknown').slice(1)
              }}
            </v-chip>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <v-container fluid class="px-6">
      <v-row>
        <!-- Deployment Configuration -->
        <v-col cols="12" md="4">
          <v-card class="deployment-config-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-cog-outline" class="me-2" />
              Deployment Configuration
            </v-card-title>
            <v-divider />
            <v-card-text>
              <deployment-config-form
                v-model="deploymentConfig"
                :loading="configLoading"
                :environments="availableEnvironments"
                @update="updateDeploymentConfig"
              />

              <v-divider class="my-4" />

              <div class="deployment-actions">
                <v-btn
                  block
                  color="primary"
                  size="large"
                  prepend-icon="mdi-rocket-launch"
                  :disabled="!canDeploy"
                  :loading="deploying"
                  @click="deployModel"
                >
                  Deploy Model
                </v-btn>

                <v-btn
                  v-if="activeDeployment"
                  block
                  color="error"
                  variant="outlined"
                  prepend-icon="mdi-stop-circle"
                  class="mt-2"
                  :loading="stopping"
                  @click="stopDeployment"
                >
                  Stop Deployment
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Active Deployments -->
        <v-col cols="12" md="8">
          <v-row>
            <!-- Deployment Status -->
            <v-col cols="12">
              <v-card class="deployment-status-card">
                <v-card-title class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center">
                    <v-icon icon="mdi-cloud-check" class="me-2" />
                    Active Deployments
                  </div>
                  <v-btn
                    variant="outlined"
                    prepend-icon="mdi-refresh"
                    :loading="refreshing"
                    @click="refreshDeployments"
                  >
                    Refresh
                  </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <deployment-status-list
                    :deployments="activeDeployments"
                    :loading="deploymentsLoading"
                    @view-logs="viewDeploymentLogs"
                    @view-metrics="viewDeploymentMetrics"
                    @scale="scaleDeployment"
                    @rollback="rollbackDeployment"
                    @delete="deleteDeployment"
                  />
                </v-card-text>
              </v-card>
            </v-col>

            <!-- API Endpoints -->
            <v-col cols="12">
              <v-card class="api-endpoints-card">
                <v-card-title class="d-flex align-center">
                  <v-icon icon="mdi-api" class="me-2" />
                  API Endpoints
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <api-endpoints-list
                    :endpoints="apiEndpoints"
                    :loading="endpointsLoading"
                    @test-endpoint="testApiEndpoint"
                    @copy-endpoint="copyEndpointUrl"
                    @generate-client="generateApiClient"
                  />
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Deployment History & Monitoring -->
      <v-row class="mt-4">
        <!-- Deployment History -->
        <v-col cols="12" md="6">
          <v-card class="deployment-history-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-history" class="me-2" />
              Deployment History
            </v-card-title>
            <v-divider />
            <v-card-text>
              <deployment-history-table
                :deployments="deploymentHistory"
                :loading="historyLoading"
                @view-deployment="viewDeploymentDetails"
                @rollback-to="rollbackToDeployment"
                @delete-deployment="deleteDeploymentFromHistory"
              />
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Performance Monitoring -->
        <v-col cols="12" md="6">
          <v-card class="monitoring-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-chart-line" class="me-2" />
              Performance Monitoring
            </v-card-title>
            <v-divider />
            <v-card-text>
              <performance-monitoring-chart
                :metrics="performanceMetrics"
                :time-range="monitoringTimeRange"
                :loading="metricsLoading"
                @time-range-change="updateMonitoringTimeRange"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import type {
  ApiEndpoint,
  Deployment,
  DeploymentConfig,
  PerformanceMetrics,
  Project,
} from '~/types/project';

// Page meta
definePageMeta({
  middleware: 'auth',
  layout: 'default',
});

// Composables
const route = useRoute();
const { getProjectIcon, getProjectColor, getStatusIcon, getStatusColor } = useIcons();
const { fetchProject } = useFetchProjects();

// Reactive state
const project = ref<Project | null>(null);
const deploymentConfig = ref<DeploymentConfig>({
  environment: 'staging',
  instance_type: 't3.medium',
  autoScaling: {
    enabled: true,
    minInstances: 1,
    maxInstances: 5,
    targetCpuUtilization: 70,
  },
  healthCheck: {
    enabled: true,
    path: '/health',
    intervalSeconds: 30,
    timeoutSeconds: 10,
    failureThreshold: 3,
  },
  resources: {
    cpu: '500m',
    memory: '1Gi',
    storage: '10Gi',
  },
  environmentVariables: {},
  secrets: {},
});

const activeDeployments = ref<Deployment[]>([]);
const deploymentHistory = ref<Deployment[]>([]);
const apiEndpoints = ref<ApiEndpoint[]>([]);
const performanceMetrics = ref<PerformanceMetrics[]>([]);
const availableEnvironments = ref(['development', 'staging', 'production']);

// Loading states
const configLoading = ref(false);
const deploying = ref(false);
const stopping = ref(false);
const refreshing = ref(false);
const deploymentsLoading = ref(false);
const endpointsLoading = ref(false);
const historyLoading = ref(false);
const metricsLoading = ref(false);

// Other state
const activeDeployment = ref<Deployment | null>(null);
const monitoringTimeRange = ref('24h');

// Computed
const canDeploy = computed(() => {
  return (
    project.value &&
    deploymentConfig.value &&
    !deploying.value &&
    deploymentConfig.value.environment
  );
});

// Methods
const updateDeploymentConfig = async (config: DeploymentConfig) => {
  try {
    configLoading.value = true;

    // Simulate API call to update deployment configuration
    console.log('Updating deployment config:', config);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    deploymentConfig.value = { ...config };
  } catch (error) {
    console.error('Failed to update deployment config:', error);
  } finally {
    configLoading.value = false;
  }
};

const deployModel = async () => {
  try {
    deploying.value = true;

    // Simulate model deployment
    console.log('Deploying model with config:', deploymentConfig.value);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Create mock active deployment
    const newDeployment: Deployment = {
      id: `deployment_${Date.now()}`,
      projectId: route.params.id as string,
      environment: deploymentConfig.value.environment,
      status: 'running',
      version: `v${Date.now()}`,
      createdAt: new Date(),
      config: deploymentConfig.value,
      url: `https://${deploymentConfig.value.environment}-${route.params.id}.example.com`,
      healthStatus: 'healthy',
    };

    activeDeployments.value.push(newDeployment);
    activeDeployment.value = newDeployment;

    // Add to history
    deploymentHistory.value.unshift(newDeployment);

    // Generate API endpoints
    generateApiEndpoints(newDeployment);
  } catch (error) {
    console.error('Failed to deploy model:', error);
  } finally {
    deploying.value = false;
  }
};

const stopDeployment = async () => {
  if (!activeDeployment.value) return;

  try {
    stopping.value = true;

    // Simulate stopping deployment
    console.log('Stopping deployment:', activeDeployment.value.id);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update deployment status
    activeDeployment.value.status = 'stopped';
    activeDeployment.value.stoppedAt = new Date();

    // Remove from active deployments
    activeDeployments.value = activeDeployments.value.filter(
      (d) => d.id !== activeDeployment.value?.id,
    );

    activeDeployment.value = null;
  } catch (error) {
    console.error('Failed to stop deployment:', error);
  } finally {
    stopping.value = false;
  }
};

const refreshDeployments = async () => {
  try {
    refreshing.value = true;

    // Simulate refreshing deployment status
    console.log('Refreshing deployments for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update deployment statuses (mock)
    activeDeployments.value.forEach((deployment) => {
      deployment.healthStatus = Math.random() > 0.1 ? 'healthy' : 'unhealthy';
    });
  } catch (error) {
    console.error('Failed to refresh deployments:', error);
  } finally {
    refreshing.value = false;
  }
};

const generateApiEndpoints = (deployment: Deployment) => {
  const baseUrl = deployment.url;

  apiEndpoints.value = [
    {
      id: `endpoint_${deployment.id}_predict`,
      deployment_id: deployment.id,
      method: 'POST',
      path: '/predict',
      url: `${baseUrl}/predict`,
      description: 'Make predictions using the deployed model',
      authenticated: true,
      rateLimit: '1000/hour',
    },
    {
      id: `endpoint_${deployment.id}_health`,
      deployment_id: deployment.id,
      method: 'GET',
      path: '/health',
      url: `${baseUrl}/health`,
      description: 'Check deployment health status',
      authenticated: false,
      rateLimit: 'unlimited',
    },
    {
      id: `endpoint_${deployment.id}_metrics`,
      deployment_id: deployment.id,
      method: 'GET',
      path: '/metrics',
      url: `${baseUrl}/metrics`,
      description: 'Get deployment metrics and statistics',
      authenticated: true,
      rateLimit: '100/hour',
    },
  ];
};

const viewDeploymentLogs = (deployment: Deployment) => {
  console.log('Viewing logs for deployment:', deployment.id);
  // Navigate to logs view or open logs modal
};

const viewDeploymentMetrics = (deployment: Deployment) => {
  console.log('Viewing metrics for deployment:', deployment.id);
  // Navigate to metrics view or open metrics modal
};

const scaleDeployment = async (deployment: Deployment, instanceCount: number) => {
  try {
    console.log(`Scaling deployment ${deployment.id} to ${instanceCount} instances`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update deployment scaling
    deployment.instanceCount = instanceCount;
  } catch (error) {
    console.error('Failed to scale deployment:', error);
  }
};

const rollbackDeployment = async (deployment: Deployment) => {
  try {
    console.log('Rolling back deployment:', deployment.id);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Implement rollback logic
  } catch (error) {
    console.error('Failed to rollback deployment:', error);
  }
};

const deleteDeployment = async (deployment: Deployment) => {
  try {
    console.log('Deleting deployment:', deployment.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Remove from active deployments
    activeDeployments.value = activeDeployments.value.filter((d) => d.id !== deployment.id);
    // Remove associated API endpoints
    apiEndpoints.value = apiEndpoints.value.filter((e) => e.deployment_id !== deployment.id);
  } catch (error) {
    console.error('Failed to delete deployment:', error);
  }
};

const testApiEndpoint = async (endpoint: ApiEndpoint) => {
  console.log('Testing API endpoint:', endpoint.url);
  // Open API testing interface or run test
};

const copyEndpointUrl = (endpoint: ApiEndpoint) => {
  navigator.clipboard.writeText(endpoint.url);
  console.log('Copied endpoint URL:', endpoint.url);
};

const generateApiClient = (endpoint: ApiEndpoint) => {
  console.log('Generating API client for endpoint:', endpoint.url);
  // Generate and download API client code
};

const viewDeploymentDetails = (deployment: Deployment) => {
  console.log('Viewing deployment details:', deployment.id);
  // Navigate to deployment detail view
};

const rollbackToDeployment = async (deployment: Deployment) => {
  console.log('Rolling back to deployment:', deployment.id);
  // Implement rollback to specific deployment
};

const deleteDeploymentFromHistory = async (deploymentId: string) => {
  try {
    console.log('Deleting deployment from history:', deploymentId);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    deploymentHistory.value = deploymentHistory.value.filter((d) => d.id !== deploymentId);
  } catch (error) {
    console.error('Failed to delete deployment from history:', error);
  }
};

const updateMonitoringTimeRange = (timeRange: string) => {
  monitoringTimeRange.value = timeRange;
  loadPerformanceMetrics();
};

const loadDeployments = async () => {
  try {
    deploymentsLoading.value = true;

    // Simulate loading deployments
    console.log('Loading deployments for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock active deployments
    activeDeployments.value = [];
  } catch (error) {
    console.error('Failed to load deployments:', error);
  } finally {
    deploymentsLoading.value = false;
  }
};

const loadApiEndpoints = async () => {
  try {
    endpointsLoading.value = true;

    // Simulate loading API endpoints
    console.log('Loading API endpoints for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    apiEndpoints.value = [];
  } catch (error) {
    console.error('Failed to load API endpoints:', error);
  } finally {
    endpointsLoading.value = false;
  }
};

const loadDeploymentHistory = async () => {
  try {
    historyLoading.value = true;

    // Simulate loading deployment history
    console.log('Loading deployment history for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    deploymentHistory.value = [];
  } catch (error) {
    console.error('Failed to load deployment history:', error);
  } finally {
    historyLoading.value = false;
  }
};

const loadPerformanceMetrics = async () => {
  try {
    metricsLoading.value = true;

    // Simulate loading performance metrics
    console.log('Loading performance metrics for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    performanceMetrics.value = [];
  } catch (error) {
    console.error('Failed to load performance metrics:', error);
  } finally {
    metricsLoading.value = false;
  }
};

// Lifecycle
onMounted(async () => {
  const projectId = route.params.id as string;

  try {
    // Load project data
    project.value = await fetchProject(projectId);

    // Load deployment-related data
    await Promise.all([
      loadDeployments(),
      loadApiEndpoints(),
      loadDeploymentHistory(),
      loadPerformanceMetrics(),
    ]);
  } catch (error) {
    console.error('Failed to load deployment page data:', error);
  }
});
</script>

<style scoped>
.deployment-page {
  min-height: 100vh;
  background-color: rgb(var(--v-theme-surface));
}

.page-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-secondary)) 100%
  );
  color: white;
  padding: 2rem 0;
  margin-bottom: 2rem;
}

.page-header .v-btn {
  color: rgba(255, 255, 255, 0.8);
}

.page-header .v-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.project-info {
  display: flex;
  align-items: center;
}

.deployment-config-card,
.deployment-status-card,
.api-endpoints-card,
.deployment-history-card,
.monitoring-card {
  height: 100%;
  transition: all 0.2s ease-in-out;
}

.deployment-config-card:hover,
.deployment-status-card:hover,
.api-endpoints-card:hover,
.deployment-history-card:hover,
.monitoring-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.deployment-actions {
  margin-top: 1rem;
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
}
</style>
