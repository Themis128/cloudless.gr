<template>
  <div class="pipeline-builder-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="breadcrumb-nav">
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          class="mb-2"
          @click="router.push('/projects')"
        >
          Back to Projects
        </v-btn>
      </div>

      <div class="header-content">
        <div class="project-info">
          <v-avatar
            color="success"
            size="48"
            class="me-4"
            aria-label="User initials avatar"
          >
            <span class="text-h6 font-weight-bold">{{ project?.name?.charAt(0) || 'U' }}</span>
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">{{ project?.name || 'Loading...' }}</h1>
            <p class="text-body-1 text-medium-emphasis mb-2">
              {{ project?.description || 'Pipeline Builder' }}
            </p>
            <v-chip
              v-if="project"
              color="primary"
              prepend-icon="mdi-circle"
              size="small"
              variant="tonal"
            >
              Active
            </v-chip>
          </div>
        </div>

        <div class="header-actions">
          <v-btn-group variant="outlined" divided>
            <v-btn prepend-icon="mdi-content-save" :loading="saving" @click="savePipeline">
              Save
            </v-btn>
            <v-btn
              prepend-icon="mdi-play"
              color="success"
              :disabled="!canRun"
              @click="runPipeline"
            >
              Run
            </v-btn>
          </v-btn-group>

          <v-menu>
            <template #activator="{ props }">
              <v-btn icon="mdi-dots-vertical" variant="outlined" v-bind="props" />
            </template>

            <v-list>
              <v-list-item
                prepend-icon="mdi-brain"
                title="View Training"
                @click="navigateTo(`/projects/${projectId}/train`)"
              />
              <v-list-item
                prepend-icon="mdi-rocket"
                title="Deploy Model"
                @click="navigateTo(`/projects/${projectId}/deploy`)"
              />
              <v-list-item
                prepend-icon="mdi-cog"
                title="Project Settings"
                @click="navigateTo(`/projects/${projectId}/config`)"
              />
              <v-divider />
              <v-list-item
                prepend-icon="mdi-download"
                title="Export Pipeline"
                @click="exportPipeline"
              />
              <v-list-item
                prepend-icon="mdi-upload"
                title="Import Pipeline"
                @click="importPipeline"
              />
            </v-list>
          </v-menu>
        </div>
      </div>
    </div>

    <!-- Pipeline Canvas -->
    <div class="pipeline-canvas-container">
      <!-- Pipeline Toolbar -->
      <FlowToolbar
        :steps="pipelineSteps"
        @add-step="addStep"
        @clear-all="clearAllSteps"
        @apply-template="applyTemplate"
      />

      <!-- Pipeline Flow Container -->
      <FlowContainer
        :steps="pipelineSteps"
        @update:steps="updatePipelineSteps"
        @add-step="addStep"
        @execute="executePipeline"
      />

      <div class="canvas-toolbar">
        <div class="toolbar-left">
          <v-btn-toggle
            v-model="canvasMode"
            mandatory
            variant="outlined"
            density="compact"
          >
            <v-btn value="select" icon="mdi-cursor-default" />
            <v-btn value="pan" icon="mdi-hand-left" />
            <v-btn value="zoom" icon="mdi-magnify" />
          </v-btn-toggle>

          <v-divider vertical class="mx-2" />

          <v-btn
            prepend-icon="mdi-fit-to-page"
            variant="outlined"
            size="small"
            @click="fitToView"
          >
            Fit to View
          </v-btn>

          <v-btn
            prepend-icon="mdi-refresh"
            variant="outlined"
            size="small"
            @click="refreshCanvas"
          >
            Reset
          </v-btn>
        </div>

        <div class="toolbar-right">
          <div class="zoom-controls">
            <v-btn
              icon="mdi-minus"
              size="small"
              variant="outlined"
              @click="zoomOut"
            />
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            <v-btn
              icon="mdi-plus"
              size="small"
              variant="outlined"
              @click="zoomIn"
            />
          </div>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="canvas-wrapper">
        <!-- Canvas will be implemented here -->
        <div v-if="project" class="canvas-placeholder">
          <v-icon size="64" color="grey-lighten-2">mdi-graph-outline</v-icon>
          <p class="text-h6 mt-4 text-grey-lighten-1">Pipeline Canvas</p>
          <p class="text-body-2 text-grey-lighten-1">Advanced canvas will be added here</p>
        </div>
        <!-- Loading State -->
        <div v-else class="loading-state">
          <v-progress-circular indeterminate size="64" color="primary" />
          <p class="text-h6 mt-4">Loading pipeline...</p>
        </div>
      </div>
    </div>

    <!-- Side Panels -->
    <div class="side-panels">
      <!-- Node Library Panel -->
      <v-navigation-drawer
        v-model="showNodeLibrary"
        location="left"
        width="300"
        temporary
        class="node-library-drawer"
      >
        <v-toolbar>
          <v-toolbar-title>Node Library</v-toolbar-title>
        </v-toolbar>

        <div class="pa-4">
          <p class="text-body-2">Node Library will be implemented here</p>
        </div>
      </v-navigation-drawer>

      <!-- Properties Panel -->
      <v-navigation-drawer
        v-model="showProperties"
        location="right"
        width="350"
        temporary
        class="properties-drawer"
      >
        <v-toolbar>
          <v-toolbar-title>Properties</v-toolbar-title>
        </v-toolbar>

        <div v-if="selectedNode" class="pa-4">
          <p class="text-body-2">Node properties will be shown here</p>
        </div>

        <div v-else class="no-selection">
          <v-icon icon="mdi-cursor-default" size="48" color="grey-lighten-1" />
          <p class="text-body-1 mt-4">Select a node to edit properties</p>
        </div>
      </v-navigation-drawer>
    </div>

    <!-- Floating Action Buttons -->
    <div class="floating-actions">
      <v-btn
        icon="mdi-plus"
        color="primary"
        size="large"
        elevation="4"
        class="fab"
        @click="showNodeLibrary = true"
      >
        <v-icon>mdi-plus</v-icon>
        <v-tooltip activator="parent" location="left">Add Node</v-tooltip>
      </v-btn>

      <v-btn
        icon="mdi-tune"
        color="secondary"
        size="large"
        elevation="4"
        class="fab"
        @click="showProperties = true"
      >
        <v-icon>mdi-tune</v-icon>
        <v-tooltip activator="parent" location="left">Properties</v-tooltip>
      </v-btn>
    </div>

    <!-- Pipeline Validation Dialog -->
    <v-dialog v-model="showValidation" max-width="600">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-check-circle" color="success" class="me-2" />
          Pipeline Validation
        </v-card-title>
        <v-card-text>
          <p class="text-body-2">Pipeline validation will be implemented here</p>
          <v-btn @click="showValidation = false">Close</v-btn>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">

import { usePipelineStore } from '@/stores/pipelineStore';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, navigateTo, definePageMeta } from '#imports';
import FlowContainer from '~/components/builder/FlowContainer.vue';
import FlowToolbar from '~/components/builder/FlowToolbar.vue';
// Removed unused useIcons import
import type { PipelineConfig, PipelineNode } from '~/types/project';

// Meta
definePageMeta({
  layout: 'projects',
  title: 'Pipeline Builder',
  requiresAuth: true,
  middleware: 'auth',
});

// Route
const route = useRoute();
const router = useRouter();
const projectId = route.params.id as string;

// Composables
// Removed unused getIcon, getIconColor
const pipelineStore = usePipelineStore();
const project = computed(() => pipelineStore.project);
const fetchProject = () => pipelineStore.fetchProject(projectId);
onMounted(fetchProject);

// State
const saving = ref(false);
const canvasMode = ref('select');
const zoomLevel = ref(1);
const selectedNode = ref<PipelineNode | null>(null);
const showNodeLibrary = ref(false);
const showProperties = ref(false);
const showValidation = ref(false);
const pipelineConfig = ref<PipelineConfig>({
  nodes: [],
  connections: [],
  metadata: {},
  global_config: {},
});

// Pipeline steps for the new builder
type PipelineStep = { component: string; data: Record<string, unknown> };
const pipelineSteps = ref<PipelineStep[]>([
  { component: 'DataInput', data: {} },
  { component: 'DataValidation', data: {} },
  { component: 'SmartProcessing', data: {} },
]);

// Computed
const canRun = computed(() => {
  return pipelineConfig.value.nodes.length > 0;
});

// Methods
// Removed unused getProjectIcon, getProjectColor, getStatusIcon, getStatusColor

const savePipeline = async () => {
  try {
    saving.value = true;
    // Save pipeline logic
    console.log('Saving pipeline...', pipelineConfig.value);
  } finally {
    saving.value = false;
  }
};

const runPipeline = () => {
  showValidation.value = true;
};

// Removed unused handleNodeSelect

// Removed unused handleNodeAdd

// Removed unused handleNodeDelete

// Removed unused handleNodeConnect

// Removed unused handlePipelineChange

// Removed unused handleNodeUpdate

// Removed unused handleNodeDragStart

// Removed unused addNodeToCanvas

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 3);
};

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.1);
};

const fitToView = () => {
  zoomLevel.value = 1;
};

const refreshCanvas = () => {
  // Reset canvas state
  selectedNode.value = null;
  canvasMode.value = 'select';
};

const exportPipeline = () => {
  const data = JSON.stringify(pipelineConfig.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pipeline-${projectId}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// New pipeline builder methods
const addStep = (step: PipelineStep) => {
  pipelineSteps.value.push(step);
};

const clearAllSteps = () => {
  pipelineSteps.value = [];
};

const applyTemplate = (template: PipelineStep[]) => {
  pipelineSteps.value = [...template];
};

const updatePipelineSteps = (steps: (PipelineStep | null | undefined)[]) => {
  pipelineSteps.value = steps.filter((s): s is PipelineStep => s != null);
};

const executePipeline = () => {
  console.log('Executing pipeline with steps:', pipelineSteps.value);
  // Implementation for pipeline execution
};

const importPipeline = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          pipelineConfig.value = config;
        } catch (error) {
          console.error('Failed to import pipeline:', error);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
};

// Lifecycle
onMounted(() => {
  if (projectId) {
    fetchProject();
  }
});
</script>

<style scoped>
.pipeline-builder-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.page-header {
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
  padding: 16px 24px;
  z-index: 10;
}

.breadcrumb-nav {
  margin-bottom: 8px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.project-info {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pipeline-canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-level {
  font-size: 0.875rem;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, rgba(var(--v-theme-primary), 0.03) 0%, transparent 50%),
    linear-gradient(90deg, rgba(var(--v-theme-outline), 0.1) 1px, transparent 1px),
    linear-gradient(180deg, rgba(var(--v-theme-outline), 0.1) 1px, transparent 1px);
  background-size:
    100% 100%,
    20px 20px,
    20px 20px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.floating-actions {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;
}

.fab {
  border-radius: 50% !important;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}

@media (max-width: 768px) {
  .page-header {
    padding: 12px 16px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .canvas-toolbar {
    padding: 8px 12px;
  }

  .toolbar-left,
  .toolbar-right {
    gap: 8px;
  }

  .floating-actions {
    bottom: 16px;
    right: 16px;
  }
}
</style>
