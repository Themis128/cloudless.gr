<template>
  <v-container class="py-6">
    <!-- Header -->
    <div class="page-header glassmorphism-header d-flex align-center justify-space-between mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold text-white">
          <v-icon size="32" class="mr-2">mdi-file-document-multiple</v-icon>
          Project Templates
        </h1>
        <p class="text-body-1 text-white opacity-90 mt-1">
          Quick-start templates for common machine learning use cases
        </p>
      </div>
      <div class="d-flex gap-2">
        <v-btn
          variant="outlined"
          size="large"
          prepend-icon="mdi-refresh"
          :loading="loading"
          class="glassmorphism-btn"
          @click="loadTemplates"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-plus"
          elevation="0"
          class="glassmorphism-btn-primary"
          @click="navigateTo('/projects/create')"
        >
          Custom Project
        </v-btn>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="loading-container glassmorphism-loading text-center py-12">
      <v-progress-circular
        indeterminate
        size="64"
        color="white"
        width="4"
      />
      <div class="mt-4 text-h6 text-white">Loading templates...</div>
      <div class="text-body-2 text-white opacity-80">Fetching available project templates</div>
    </div>

    <!-- Templates -->
    <v-row v-else>
      <v-col
        v-for="template in templates"
        :key="template.id"
        cols="12"
        sm="6"
        lg="4"
        xl="3"
      >
        <v-card
          class="h-100 template-card glassmorphism-card"
          elevation="0"
          hover
          @click="useTemplate(template)"
        >
          <div class="template-header" :class="`category-${template.category}`">
            <v-card-title class="pb-2 d-flex align-center">
              <v-icon :icon="template.icon" size="24" class="mr-2" />
              <div class="flex-grow-1">
                <div class="text-subtitle-1 font-weight-bold">{{ template.name }}</div>
                <v-chip
                  :color="getCategoryColor(template.category)"
                  size="x-small"
                  variant="tonal"
                  class="mt-1"
                >
                  {{ template.category }}
                </v-chip>
              </div>
            </v-card-title>
          </div>

          <v-card-text class="pt-3 pb-2">
            <p class="text-body-2 mb-3 text-truncate-2">{{ template.description }}</p>

            <div class="mb-2">
              <div class="text-caption text-medium-emphasis mb-1">Features:</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip
                  v-for="feature in template.features.slice(0, 2)"
                  :key="feature"
                  size="x-small"
                  variant="outlined"
                  class="text-caption"
                >
                  {{ feature }}
                </v-chip>
                <v-chip
                  v-if="template.features.length > 2"
                  size="x-small"
                  variant="outlined"
                  class="text-caption"
                >
                  +{{ template.features.length - 2 }}
                </v-chip>
              </div>
            </div>

            <div class="mb-2">
              <div class="text-caption text-medium-emphasis mb-1">Tech:</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip
                  v-for="tech in template.techStack.slice(0, 2)"
                  :key="tech"
                  size="x-small"
                  color="info"
                  variant="tonal"
                  class="text-caption"
                >
                  {{ tech }}
                </v-chip>
                <v-chip
                  v-if="template.techStack.length > 2"
                  size="x-small"
                  color="info"
                  variant="tonal"
                  class="text-caption"
                >
                  +{{ template.techStack.length - 2 }}
                </v-chip>
              </div>
            </div>

            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-icon size="14" class="me-1" :color="getDifficultyColor(template.difficulty)">
                  mdi-signal-cellular-{{ getDifficultyIcon(template.difficulty) }}
                </v-icon>
                <span class="text-caption">{{ template.difficulty }}</span>
              </div>
              <div class="d-flex align-center text-caption text-medium-emphasis">
                <v-icon size="12" class="me-1">mdi-clock-outline</v-icon>
                {{ template.estimatedTime }}
              </div>
            </div>
          </v-card-text>

          <v-card-actions class="px-3 pb-3 pt-0">
            <v-btn
              variant="text"
              size="x-small"
              prepend-icon="mdi-eye"
              @click.stop="previewTemplate(template)"
            >
              Preview
            </v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              size="x-small"
              prepend-icon="mdi-rocket-launch"
              @click.stop="useTemplate(template)"
            >
              Use
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Preview Dialog -->
    <v-dialog v-model="showPreviewDialog" max-width="800">
      <v-card v-if="selectedTemplate" class="glassmorphism-dialog">
        <v-card-title class="d-flex align-center glassmorphism-dialog-header">
          <v-icon :icon="selectedTemplate.icon" class="me-2" />
          {{ selectedTemplate.name }} Preview
        </v-card-title>
        <v-divider color="rgba(255, 255, 255, 0.2)" />
        <v-card-text class="pa-6">
          <h3 class="text-h6 mb-2">Description</h3>
          <p class="text-body-1">{{ selectedTemplate.description }}</p>

          <h3 class="text-h6 mt-4 mb-2">What's Included</h3>
          <v-list density="compact" class="transparent">
            <v-list-item
              v-for="item in selectedTemplate.includes"
              :key="item"
              prepend-icon="mdi-check-circle"
              :title="item"
              class="glassmorphism-list-item"
            />
          </v-list>

          <h3 class="text-h6 mt-4 mb-2">Pipeline Structure</h3>
          <v-img
            :src="selectedTemplate.pipelineImage || '/images/pipeline-preview.png'"
            alt="Pipeline Preview"
            class="rounded glassmorphism-image"
            height="200"
            cover
          />
        </v-card-text>
        <v-card-actions class="glassmorphism-dialog-actions">
          <v-spacer />
          <v-btn
            variant="text"
            class="glassmorphism-btn"
            @click="showPreviewDialog = false"
          >Close</v-btn>
          <v-btn
            color="primary"
            class="glassmorphism-btn-primary"
            @click="useTemplate(selectedTemplate)"
          >Use This Template</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { definePageMeta, navigateTo } from '#imports';
import { mockTemplates } from '~/data/templates';
import type { ProjectTemplate } from '~/types/project';

definePageMeta({
  middleware: 'auth',
  layout: 'projects',
  title: 'Project Templates',
});

const loading = ref(false);
const templates = ref<ProjectTemplate[]>([]);
const showPreviewDialog = ref(false);
const selectedTemplate = ref<ProjectTemplate | null>(null);

const loadTemplates = async () => {
  loading.value = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    templates.value = mockTemplates as ProjectTemplate[];
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
    Recommendation: 'orange',
    'Anomaly Detection': 'red',
    'Conversational AI': 'indigo',
  };
  return map[category] || 'primary';
};

const getDifficultyColor = (difficulty: string) => {
  return (
    { Beginner: 'success', Intermediate: 'warning', Advanced: 'error' }[difficulty] || 'primary'
  );
};

const getDifficultyIcon = (difficulty: string) => {
  return { Beginner: '1', Intermediate: '2', Advanced: '3' }[difficulty] || '1';
};

onMounted(() => loadTemplates());
</script>

<style scoped>
.glassmorphism-card {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
}

.glassmorphism-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.6) 50%,
    transparent 100%
  );
  z-index: 1;
}

.page-header.glassmorphism-header {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 24px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.page-header.glassmorphism-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.5) 50%,
    transparent 100%
  );
  z-index: 1;
}

/* Glassmorphism Buttons */
.glassmorphism-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  color: white !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-btn:hover {
  background: rgba(255, 255, 255, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.glassmorphism-btn-primary {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.8) 0%,
    rgba(var(--v-theme-primary), 0.9) 100%
  ) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  color: white !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-btn-primary:hover {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.9) 0%,
    rgba(var(--v-theme-primary), 1) 100%
  ) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.3);
}

.template-card {
  cursor: pointer;
  min-height: 280px;
  max-height: 320px;
}

.template-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
}

.template-header {
  padding: 12px 16px 8px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.template-header .v-card-title {
  padding: 0;
  font-size: 0.95rem;
  line-height: 1.3;
}

.template-card .v-card-text {
  padding: 16px;
  font-size: 0.875rem;
}

.template-card .v-card-actions {
  min-height: 48px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-height: 2.8em;
}

/* Loading State */
.glassmorphism-loading {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  margin: 24px 0;
}

/* Dialog Glassmorphism */
.glassmorphism-dialog {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.9) 50%,
    rgba(241, 245, 249, 0.85) 100%
  ) !important;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.1);
}

.glassmorphism-dialog-header {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #181818 !important;
}

.glassmorphism-dialog-actions {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.glassmorphism-list-item {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.glassmorphism-list-item:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(4px);
}

.glassmorphism-image {
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Ensure dialog text is readable */
.glassmorphism-dialog .v-card-text {
  color: #181818 !important;
}

.glassmorphism-dialog .v-card-text h3 {
  color: #181818 !important;
}

.glassmorphism-dialog .v-card-text p {
  color: #181818 !important;
}
</style>
