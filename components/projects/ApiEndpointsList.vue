<template>
  <div class="api-endpoints-list">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
      <p class="text-body-2 mt-4">Loading API endpoints...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="endpoints.length === 0" class="text-center py-8">
      <v-icon icon="mdi-api" size="48" class="mb-4 text-disabled" />
      <p class="text-body-1 text-disabled">No API endpoints available</p>
      <p class="text-body-2 text-disabled">Deploy a model to see API endpoints</p>
    </div>

    <!-- Endpoints List -->
    <div v-else>
      <v-list lines="two">
        <v-list-item
          v-for="endpoint in endpoints"
          :key="endpoint.id"
          class="endpoint-item mb-2"
          :ripple="false"
        >
          <template #prepend>
            <v-chip
              :color="getMethodColor(endpoint.method)"
              size="small"
              class="mr-3 font-weight-bold"
              variant="flat"
            >
              {{ endpoint.method }}
            </v-chip>
          </template>

          <div class="endpoint-content">
            <v-list-item-title class="font-weight-medium">
              {{ endpoint.path }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-wrap">
              {{ endpoint.description }}
            </v-list-item-subtitle>

            <!-- Additional Info -->
            <div class="endpoint-meta mt-2">
              <v-chip
                v-if="endpoint.authenticated"
                size="x-small"
                color="warning"
                variant="outlined"
                class="mr-2"
              >
                <v-icon icon="mdi-lock" size="12" class="mr-1" />
                Auth Required
              </v-chip>
              <v-chip size="x-small" color="info" variant="outlined" class="mr-2">
                {{ endpoint.rateLimit }}
              </v-chip>
            </div>
          </div>

          <template #append>
            <div class="endpoint-actions">
              <v-tooltip text="Copy URL" location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-content-copy"
                    size="small"
                    variant="text"
                    color="primary"
                    @click="$emit('copy-endpoint', endpoint)"
                  />
                </template>
              </v-tooltip>

              <v-tooltip text="Test Endpoint" location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-play"
                    size="small"
                    variant="text"
                    color="success"
                    @click="$emit('test-endpoint', endpoint)"
                  />
                </template>
              </v-tooltip>

              <v-tooltip text="Generate Client" location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-code-braces"
                    size="small"
                    variant="text"
                    color="info"
                    @click="$emit('generate-client', endpoint)"
                  />
                </template>
              </v-tooltip>
            </div>
          </template>
        </v-list-item>
      </v-list>

      <!-- Action Bar -->
      <v-divider class="my-4" />
      <div class="actions-bar">
        <v-btn variant="outlined" prepend-icon="mdi-download" @click="downloadCollection">
          Download Collection
        </v-btn>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-file-document"
          class="ml-2"
          @click="viewDocumentation"
        >
          API Docs
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '@/types/project';

interface Props {
  endpoints: ApiEndpoint[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  'test-endpoint': [endpoint: ApiEndpoint];
  'copy-endpoint': [endpoint: ApiEndpoint];
  'generate-client': [endpoint: ApiEndpoint];
}>();

const getMethodColor = (method: string) => {
  switch (method.toLowerCase()) {
    case 'get':
      return 'success';
    case 'post':
      return 'primary';
    case 'put':
      return 'warning';
    case 'patch':
      return 'info';
    case 'delete':
      return 'error';
    default:
      return 'default';
  }
};

const downloadCollection = () => {
  // Generate and download Postman collection or OpenAPI spec
  const collection = {
    info: {
      name: 'API Endpoints Collection',
      description: 'Generated API collection for deployed model',
    },
    item: props.endpoints.map((endpoint) => ({
      name: endpoint.path,
      request: {
        method: endpoint.method,
        header: endpoint.authenticated
          ? [
              {
                key: 'Authorization',
                value: 'Bearer {{token}}',
                type: 'text',
              },
            ]
          : [],
        url: {
          raw: endpoint.url,
          protocol: 'https',
          host: [endpoint.url.replace('https://', '').split('/')[0]],
          path: endpoint.path?.split('/').filter(Boolean) || [],
        },
      },
    })),
  };

  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'api-collection.json';
  link.click();
  URL.revokeObjectURL(url);
};

const viewDocumentation = () => {
  // Open API documentation in new tab
  window.open('/docs/api', '_blank');
};
</script>

<style scoped>
.api-endpoints-list {
  min-height: 200px;
}

.endpoint-item {
  border: 1px solid rgba(var(--v-border-color), 0.12);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.5);
  transition: all 0.2s ease;
}

.endpoint-item:hover {
  background: rgba(var(--v-theme-surface), 0.8);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.endpoint-content {
  flex: 1;
}

.endpoint-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.endpoint-actions {
  display: flex;
  gap: 4px;
}

.actions-bar {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

@media (max-width: 600px) {
  .endpoint-actions {
    flex-direction: column;
  }

  .actions-bar {
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .actions-bar .v-btn {
    margin-left: 0 !important;
  }
}
</style>
