<template>
  <div class="deployment-history-table">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
      <p class="text-body-2 mt-4">Loading deployment history...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="deployments.length === 0" class="text-center py-8">
      <v-icon icon="mdi-history" size="48" class="mb-4 text-disabled" />
      <p class="text-body-1 text-disabled">No deployment history</p>
      <p class="text-body-2 text-disabled">Previous deployments will appear here</p>
    </div>

    <!-- Deployments Table -->
    <div v-else>
      <v-data-table
        :headers="headers"
        :items="deployments"
        :items-per-page="10"
        class="deployment-table"
        no-data-text="No deployments found"
      >
        <!-- Status Column -->
        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="flat"
            class="font-weight-medium"
          >
            <v-icon :icon="getStatusIcon(item.status)" size="12" class="mr-1" />
            {{ item.status }}
          </v-chip>
        </template>

        <!-- Name Column -->
        <template #item.name="{ item }">
          <div class="deployment-name">
            <div class="font-weight-medium">{{ item.name }}</div>
            <div class="text-caption text-disabled">{{ item.version || 'v1.0.0' }}</div>
          </div>
        </template>

        <!-- Environment Column -->
        <template #item.environment="{ item }">
          <v-chip
            :color="getEnvironmentColor(item.environment || '')"
            size="small"
            variant="outlined"
          >
            {{ item.environment }}
          </v-chip>
        </template>

        <!-- Created At Column -->
        <template #item.created_at="{ item }">
          <div class="date-info">
            <div>{{ formatDate(item.created_at) }}</div>
            <div class="text-caption text-disabled">{{ formatTime(item.created_at || '') }}</div>
          </div>
        </template>

        <!-- Duration Column -->
        <template #item.duration="{ item }">
          <div class="text-body-2">
            {{ calculateDuration(item) }}
          </div>
        </template>

        <!-- Actions Column -->
        <template #item.actions="{ item }">
          <div class="action-buttons">
            <v-tooltip text="View Details" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-eye"
                  size="small"
                  variant="text"
                  color="primary"
                  @click="$emit('view-deployment', item)"
                />
              </template>
            </v-tooltip>

            <v-tooltip text="Rollback to this version" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-restore"
                  size="small"
                  variant="text"
                  color="warning"
                  :disabled="item.status === 'running'"
                  @click="$emit('rollback-to', item)"
                />
              </template>
            </v-tooltip>

            <v-tooltip text="Download Logs" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-download"
                  size="small"
                  variant="text"
                  color="info"
                  @click="downloadLogs(item)"
                />
              </template>
            </v-tooltip>

            <v-menu>
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
              </template>
              <v-list>
                <v-list-item @click="duplicateDeployment(item)">
                  <template #prepend>
                    <v-icon icon="mdi-content-duplicate" />
                  </template>
                  <v-list-item-title>Duplicate</v-list-item-title>
                </v-list-item>
                <v-list-item @click="exportConfig(item)">
                  <template #prepend>
                    <v-icon icon="mdi-export" />
                  </template>
                  <v-list-item-title>Export Config</v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item @click="$emit('delete-deployment', item.id)" class="text-error">
                  <template #prepend>
                    <v-icon icon="mdi-delete" />
                  </template>
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Deployment } from '@/types/project';

interface Props {
  deployments: Deployment[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  'view-deployment': [deployment: Deployment];
  'rollback-to': [deployment: Deployment];
  'delete-deployment': [deploymentId: string];
}>();

const headers: any[] = [
  { title: 'Status', key: 'status', sortable: true, width: '120px' },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Environment', key: 'environment', sortable: true, width: '140px' },
  { title: 'Created', key: 'created_at', sortable: true, width: '160px' },
  { title: 'Duration', key: 'duration', sortable: false, width: '120px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '160px', align: 'center' },
];

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'running':
      return 'success';
    case 'deploying':
      return 'warning';
    case 'failed':
      return 'error';
    case 'stopped':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'running':
      return 'mdi-check-circle';
    case 'deploying':
      return 'mdi-loading';
    case 'failed':
      return 'mdi-alert-circle';
    case 'stopped':
      return 'mdi-stop-circle';
    default:
      return 'mdi-help-circle';
  }
};

const getEnvironmentColor = (environment: string) => {
  switch (environment?.toLowerCase()) {
    case 'production':
      return 'error';
    case 'staging':
      return 'warning';
    case 'development':
      return 'info';
    default:
      return 'default';
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
};

const formatTime = (dateString: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const calculateDuration = (deployment: Deployment) => {
  if (!deployment.created_at) return 'N/A';

  const start = new Date(deployment.created_at);
  const end = deployment.stoppedAt ? new Date(deployment.stoppedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
};

const downloadLogs = (deployment: Deployment) => {
  // Simulate downloading logs
  const logs =
    `Deployment Logs for ${deployment.name}\n` +
    `Environment: ${deployment.environment}\n` +
    `Status: ${deployment.status}\n` +
    `Created: ${deployment.created_at}\n` +
    `\n--- Application Logs ---\n` +
    `[INFO] Deployment started\n` +
    `[INFO] Model loaded successfully\n` +
    `[INFO] Health checks passed\n` +
    `[INFO] Deployment complete\n`;

  const blob = new Blob([logs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deployment-${deployment.id}-logs.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

const duplicateDeployment = (deployment: Deployment) => {
  // This would trigger a duplication flow
  console.log('Duplicating deployment:', deployment.id);
};

const exportConfig = (deployment: Deployment) => {
  const config = {
    deployment: {
      name: deployment.name,
      environment: deployment.environment,
      config: deployment.config,
    },
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deployment-${deployment.id}-config.json`;
  link.click();
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.deployment-history-table {
  min-height: 300px;
}

.deployment-table {
  background: transparent;
}

.deployment-name {
  min-width: 150px;
}

.date-info {
  min-width: 120px;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
}

:deep(.v-data-table__wrapper) {
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), 0.12);
}

:deep(.v-data-table-header__content) {
  font-weight: 600;
}

:deep(.v-data-table__tr:hover) {
  background: rgba(var(--v-theme-primary), 0.04);
}

@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
  }
}
</style>
