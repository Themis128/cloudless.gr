<template>
  <v-container class="py-6">
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold text-primary">
          <v-icon size="32" class="mr-2">mdi-file-document-multiple</v-icon>
          Project Templates
        </h1>
        <p class="text-body-1 text-medium-emphasis mt-1">
          Quick-start templates for common machine learning use cases
        </p>
      </div>
      <div class="d-flex gap-2">
        <v-btn
          variant="outlined"
          size="large"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="loadTemplates"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-plus"
          elevation="3"
          @click="navigateTo('/projects/create')"
        >
          Custom Project
        </v-btn>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="text-center py-12">
      <v-progress-circular indeterminate size="64" color="primary" width="6" />
      <div class="mt-4 text-h6">Loading templates...</div>
      <div class="text-body-2 text-medium-emphasis">
        Fetching available project templates
      </div>
    </div>

    <!-- Templates -->
    <v-row v-else>
      <v-col v-for="template in templates" :key="template.id" cols="12" md="6" lg="4">
        <v-card class="h-100 template-card" elevation="2" hover @click="useTemplate(template)">
          <div class="template-header" :class="`category-${template.category}`">
            <v-card-title class="pb-2 d-flex align-center">
              <v-icon :icon="template.icon" size="32" class="mr-3" />
              <div class="flex-grow-1">
                <div class="text-h6">{{ template.name }}</div>
                <v-chip
                  :color="getCategoryColor(template.category)"
                  size="x-small"
                  class="mt-1"
                >
                  {{ template.category }}
                </v-chip>
              </div>
            </v-card-title>
          </div>

          <v-card-subtitle class="pb-3 text-body-2">
            {{ template.description }}
          </v-card-subtitle>

          <v-card-text class="pt-2">
            <div class="mb-3">
              <div class="text-subtitle-2 mb-2">Features:</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip
                  v-for="feature in template.features"
                  :key="feature"
                  size="x-small"
                  variant="outlined"
                  class="text-caption"
                >
                  {{ feature }}
                </v-chip>
              </div>
            </div>

            <div class="mb-3">
              <div class="text-subtitle-2 mb-2">Tech Stack:</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip
                  v-for="tech in template.techStack"
                  :key="tech"
                  size="x-small"
                  color="info"
                  variant="tonal"
                  class="text-caption"
                >
                  {{ tech }}
                </v-chip>
              </div>
            </div>

            <div class="d-flex align-center mb-3">
              <v-icon
                size="16"
                class="me-1"
                :color="getDifficultyColor(template.difficulty)"
              >
                mdi-signal-cellular-{{ getDifficultyIcon(template.difficulty) }}
              </v-icon>
              <span class="text-body-2">{{ template.difficulty }} Level</span>
            </div>

            <div class="d-flex align-center text-caption text-medium-emphasis">
              <v-icon size="14" class="me-1">mdi-clock-outline</v-icon>
              Setup time: ~{{ template.estimatedTime }}
            </div>
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-btn variant="text" size="small" prepend-icon="mdi-eye" @click.stop="previewTemplate(template)">
              Preview
            </v-btn>
            <v-spacer />
            <v-btn color="primary" size="small" prepend-icon="mdi-rocket-launch" @click.stop="useTemplate(template)">
              Use Template
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Preview Dialog -->
    <v-dialog v-model="showPreviewDialog" max-width="800">
      <v-card v-if="selectedTemplate">
        <v-card-title class="d-flex align-center">
          <v-icon :icon="selectedTemplate.icon" class="me-2" />
          {{ selectedTemplate.name }} Preview
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <h3 class="text-h6 mb-2">Description</h3>
          <p class="text-body-1">{{ selectedTemplate.description }}</p>

          <h3 class="text-h6 mt-4 mb-2">What's Included</h3>
          <v-list density="compact">
            <v-list-item
              v-for="item in selectedTemplate.includes"
              :key="item"
              prepend-icon="mdi-check-circle"
              :title="item"
            />
          </v-list>

          <h3 class="text-h6 mt-4 mb-2">Pipeline Structure</h3>
          <v-img
            :src="selectedTemplate.pipelineImage || '/images/pipeline-preview.png'"
            alt="Pipeline Preview"
            class="rounded"
            height="200"
            cover
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showPreviewDialog = false">Close</v-btn>
          <v-btn color="primary" @click="useTemplate(selectedTemplate)">Use This Template</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import mockTemplates from '~/data/templates';

definePageMeta({
  middleware: 'auth',
  layout: 'projects',
  title: 'Project Templates',
});

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  features: string[];
  techStack: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  includes: string[];
  pipelineImage?: string;
  config: any;
}

const loading = ref(false);
const templates = ref<ProjectTemplate[]>([]);
const showPreviewDialog = ref(false);
const selectedTemplate = ref<ProjectTemplate | null>(null);

const loadTemplates = async () => {
  loading.value = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    templates.value = mockTemplates;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const previewTemplate = (template: ProjectTemplate) => {
  selectedTemplate.value = template;
  showPreviewDialog.value = true;
};

const useTemplate = async (template: ProjectTemplate) => {
  await navigateTo({ path: '/projects/create', query: { template: template.id } });
};

const getCategoryColor = (category: string) => {
  const map: Record<string, string> = {
    'Computer Vision': 'purple',
    'Natural Language': 'blue',
    'Time Series': 'green',
    'Recommendation': 'orange',
    'Anomaly Detection': 'red',
    'Conversational AI': 'indigo',
  };
  return map[category] || 'primary';
};

const getDifficultyColor = (difficulty: string) => {
  return { Beginner: 'success', Intermediate: 'warning', Advanced: 'error' }[difficulty] || 'primary';
};

const getDifficultyIcon = (difficulty: string) => {
  return { Beginner: '1', Intermediate: '2', Advanced: '3' }[difficulty] || '1';
};

onMounted(() => loadTemplates());
</script>

<style scoped>
.template-card {
  transition: 0.2s ease;
  cursor: pointer;
  border: 1px solid rgba(var(--v-border-color), 0.12);
}
.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.template-header {
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8), rgba(var(--v-theme-primary), 0.05));
}
</style>
