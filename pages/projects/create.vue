<script setup lang="ts">

import { ref } from 'vue';



import { definePageMeta } from '#imports';
import { navigateTo } from '#app';
import { useCreateProjectStore } from '@/stores/createProjectStore';
import ProjectCreateForm from '@/components/projects/ProjectCreateForm.vue';
import type { CreateProjectData, Project } from '~/types/project';

definePageMeta({
  layout: 'projects',
  title: 'Create Project',
});

const userName = 'User';
const userInitials = 'U';

const createProjectStore = useCreateProjectStore();
const loading = ref(false);
const errorMsg = ref<string | null>(null);
const successMsg = ref<string | null>(null);

const createProject = async (data: CreateProjectData): Promise<Project> => {
  const transformedData = {
    ...data,
    description: data.description || undefined,
    framework: data.framework || undefined,
    type: (data.type || 'custom') as 'cv' | 'nlp' | 'regression' | 'recommendation' | 'time-series' | 'custom',
    config: {
      environment: data.environment,
      enable_versioning: data.enable_versioning,
      enable_monitoring: data.enable_monitoring,
      enable_auto_scaling: data.enable_auto_scaling,
      enable_experiment_tracking: data.enable_experiment_tracking,
      tags: data.tags,
    },
  };
  return await createProjectStore.createProject(transformedData);
};

const handleCreateProject = async (projectData: CreateProjectData) => {
  errorMsg.value = null;
  successMsg.value = null;
  loading.value = true;
  try {
    const project = await createProject(projectData);
    successMsg.value = 'Project created successfully!';
    setTimeout(() => {
      navigateTo(`/projects/${project.id}`);
    }, 1000);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'message' in err) {
      errorMsg.value = (err as { message?: string }).message || 'Failed to create project.';
    } else {
      errorMsg.value = 'Failed to create project.';
    }
    console.error('Failed to create project', err);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="create-project-page">
    <div class="page-header">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        :disabled="loading"
        aria-label="Back to Projects"
        @click="navigateTo('/projects')"
      >
        Back to Projects
      </v-btn>
      <div class="header-content">
        <v-avatar
          size="48"
          color="success"
          class="me-4"
          aria-label="User initials avatar"
        >
          <span class="text-h6 font-weight-bold">{{ userInitials }}</span>
        </v-avatar>
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">
            {{ userName ? `${userName}'s New Project` : 'Create New Project' }}
          </h1>
          <p class="text-body-1 text-medium-emphasis">
            {{
              userName
                ? `Set up ${userName}'s new ML pipeline project with your preferred configuration`
                : 'Set up a new ML pipeline project with your preferred configuration'
            }}
          </p>
        </div>
      </div>
    </div>
    <!-- Create Project Form -->
    <v-card class="create-form-card" elevation="2">
      <v-card-text class="pa-8">
        <ProjectCreateForm
          :loading="loading"
          :show-advanced="true"
          :disabled="loading"
          @create="handleCreateProject"
          @cancel="navigateTo('/projects')"
        />
        <v-alert v-if="errorMsg" type="error" class="mt-4">{{ errorMsg }}</v-alert>
        <v-alert v-if="successMsg" type="success" class="mt-4">{{ successMsg }}</v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.create-project-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  color: white;
}

.page-header {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  align-items: center;
}

.header-content .v-avatar {
  flex-shrink: 0;
}

.header-content div {
  flex: 1;
  min-width: 0;
}

.header-content h1 {
  color: white !important;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin-bottom: 0.25rem !important;
}

.header-content p {
  color: rgba(255, 255, 255, 0.9) !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  margin: 0 !important;
}

.create-form-card {
  border-radius: 24px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(248, 250, 252, 0.8) 50%,
    rgba(241, 245, 249, 0.75) 100%
  );
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.15),
    0 4px 12px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.create-form-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.8) 50%,
    transparent 100%
  );
  z-index: 1;
}

.create-form-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.2),
    0 8px 16px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

/* Comprehensive black text styling for all form elements */
.create-form-card :deep(*),
.create-form-card *,
.create-form-card :deep(.v-label),
.create-form-card :deep(.v-field-label),
.create-form-card :deep(.v-field__input),
.create-form-card :deep(.v-select__selection-text),
.create-form-card :deep(.section-title),
.create-form-card :deep(.v-btn__content),
.create-form-card :deep(.v-expansion-panel-title),
.create-form-card :deep(.v-list-item-title),
.create-form-card :deep(input),
.create-form-card :deep(textarea),
.create-form-card :deep(label),
.create-form-card :deep(h1),
.create-form-card :deep(h2),
.create-form-card :deep(h3),
.create-form-card :deep(h4),
.create-form-card :deep(h5),
.create-form-card :deep(h6),
.create-form-card :deep(p),
.create-form-card :deep(span) {
  color: #181818 !important;
}

/* Make text white throughout the page except inside the card */
.create-project-page > *:not(.create-form-card) {
  color: white !important;
}

/* Ensure all header elements are white */
.page-header,
.page-header *,
.header-content,
.header-content *,
.header-content h1,
.header-content p {
  color: white !important;
}

/* Back button styling */
.page-header .v-btn,
.page-header .v-btn * {
  color: white !important;
}

/* Avatar initials styling */
.header-content .v-avatar span {
  color: white !important;
}

/* Advanced Settings Integration Styles */
.create-form-card :deep(.form-section) {
  position: relative;
}

.create-form-card :deep(.section-title) {
  color: #181818 !important;
  font-weight: 600 !important;
  margin-bottom: 20px !important;
  padding-bottom: 8px;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.1);
  display: flex !important;
  align-items: center !important;
}

.create-form-card :deep(.section-title .v-icon) {
  color: rgba(var(--v-theme-primary), 0.8) !important;
  margin-right: 12px !important;
}

/* Advanced Settings Switches */
.create-form-card :deep(.v-switch .v-label) {
  color: #181818 !important;
  font-weight: 500 !important;
}

.create-form-card :deep(.v-switch .v-selection-control__wrapper) {
  margin-right: 12px;
}

/* Advanced Settings Chips */
.create-form-card :deep(.v-chip) {
  background: rgba(var(--v-theme-primary), 0.1) !important;
  color: rgba(#181818, 0.7) !important;
  font-size: 0.75rem !important;
  height: 24px !important;
}

/* Tags field styling */
.create-form-card :deep(.v-text-field .v-field__input) {
  color: #181818 !important;
}

.create-form-card :deep(.v-text-field .v-field__append-inner) {
  color: rgba(#181818, 0.6) !important;
}

.create-form-card :deep(.v-messages) {
  color: rgba(#181818, 0.6) !important;
}
</style>
