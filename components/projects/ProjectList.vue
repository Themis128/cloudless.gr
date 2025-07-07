<template>
  <div class="project-list">
    <!-- Grid View -->
    <div v-if="viewMode === 'grid'" class="project-grid">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @click="$emit('project-click', project)"
        @delete="$emit('project-delete', project.id)"
      />
    </div>

    <!-- List View -->
    <v-card v-else class="project-list-view" elevation="1">
      <v-list>
        <template v-for="(project, index) in projects" :key="project.id">
          <v-list-item class="project-list-item" @click="$emit('project-click', project)">
            <template #prepend>
              <v-avatar :color="getProjectColor(project.type)" size="40">
                <v-icon :icon="getProjectIcon(project.type)" color="white" />
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ project.name }}
            </v-list-item-title>

            <v-list-item-subtitle class="text-wrap mt-1">
              {{ project.description || 'No description provided' }}
            </v-list-item-subtitle>

            <template #append>
              <div class="list-item-meta">
                <v-chip
                  :color="getStatusColor(project.status)"
                  :icon="getStatusIcon(project.status)"
                  size="small"
                  variant="tonal"
                  class="me-2"
                >
                  {{ safeStatusDisplay(project.status) }}
                </v-chip>

                <div class="text-caption text-medium-emphasis">
                  {{ formatDate(project.updated_at) }}
                </div>

                <v-menu>
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      size="small"
                      variant="text"
                      v-bind="menuProps"
                      @click.stop
                    />
                  </template>

                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-eye"
                      title="View"
                      @click="$emit('project-click', project)"
                    />
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      title="Edit"
                      @click="editProject(project)"
                    />
                    <v-list-item
                      prepend-icon="mdi-content-duplicate"
                      title="Duplicate"
                      @click="duplicateProject(project)"
                    />
                    <v-divider />
                    <v-list-item
                      prepend-icon="mdi-trash-can"
                      title="Delete"
                      class="text-error"
                      @click="confirmDelete(project)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </template>
          </v-list-item>

          <v-divider v-if="index < projects.length - 1" />
        </template>
      </v-list>
    </v-card>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-alert" color="error" class="me-2" />
          Confirm Delete
        </v-card-title>

        <v-card-text>
          Are you sure you want to delete the project
          <strong>{{ projectToDelete?.name }}</strong>? This action cannot be undone.
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false"> Cancel </v-btn>
          <v-btn color="error" @click="handleDelete"> Delete </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useIcons } from '~/composables/useIcons';
import type { Project } from '~/types/project';
import ProjectCard from './ProjectCard.vue';

// Props
interface Props {
  projects: Project[];
  viewMode: 'grid' | 'list';
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

// Emits
const emit = defineEmits<{
  'project-click': [project: Project];
  'project-delete': [projectId: string];
}>();

// Composables
const { getIcon, getIconColor } = useIcons();

// State
const deleteDialog = ref(false);
const projectToDelete = ref<Project | null>(null);

// Methods
const getProjectIcon = (type: string) => {
  return getIcon('project', type);
};

const getProjectColor = (type: string) => {
  return getIconColor(type);
};

const getStatusIcon = (status: string) => {
  return getIcon('status', status);
};

const getStatusColor = (status: string) => {
  const colorMap = {
    draft: 'grey',
    active: 'success',
    training: 'info',
    deployed: 'primary',
    completed: 'success',
    error: 'error',
    archived: 'grey-darken-1',
    paused: 'warning',
  };
  return colorMap[status as keyof typeof colorMap] || 'grey';
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
  return `${Math.ceil(diffDays / 365)} years ago`;
};

const safeStatusDisplay = (status: string) => {
  const statusMap = {
    draft: 'Draft',
    active: 'Active',
    training: 'Training',
    deployed: 'Deployed',
    completed: 'Completed',
    error: 'Error',
    archived: 'Archived',
    paused: 'Paused',
  };
  return statusMap[status as keyof typeof statusMap] || status || 'Unknown';
};

import { navigateTo } from '#app';

const editProject = (project: Project) => {
  navigateTo(`/projects/${project.id}/config`);
};

const duplicateProject = (project: Project) => {
  // Implementation for duplicating project
  console.log('Duplicate project:', project.name);
};

const confirmDelete = (project: Project) => {
  projectToDelete.value = project;
  deleteDialog.value = true;
};

const handleDelete = () => {
  if (projectToDelete.value) {
    emit('project-delete', projectToDelete.value.id);
    deleteDialog.value = false;
    projectToDelete.value = null;
  }
};
</script>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.project-list-view {
  border-radius: 12px;
  /* Glassmorphism styling for starry background */
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.project-list-item {
  padding: 16px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.project-list-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

/* White text for list items on glassmorphism background */
.project-list-view :deep(.v-list-item-title),
.project-list-view :deep(.v-list-item-subtitle) {
  color: rgba(255, 255, 255, 0.95) !important;
}

.project-list-view :deep(.v-list-item-subtitle) {
  color: rgba(255, 255, 255, 0.75) !important;
}

.project-list-view :deep(.text-caption) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.list-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .project-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .list-item-meta {
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
}
</style>
