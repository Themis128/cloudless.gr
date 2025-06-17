<template>
  <v-card
    class="project-card"
    :class="{ 'project-card--loading': loading }"
    elevation="2"
    hover
    @click="$emit('click')"
  >
    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>

    <!-- Card Header -->
    <v-card-title class="card-header">
      <div class="header-content">
        <v-avatar :color="getProjectColor(project.type)" size="40" class="me-3">
          <v-icon :icon="getProjectIcon(project.type)" color="white" />
        </v-avatar>
        
        <div class="project-info">
          <h3 class="project-name">{{ project.name }}</h3>
          <p class="project-type">{{ getProjectTypeLabel(project.type) }}</p>
        </div>
      </div>

      <v-menu>
        <template #activator="{ props }">
          <v-btn
            icon="mdi-dots-vertical"
            size="small"
            variant="text"
            v-bind="props"
            class="card-menu-btn"
            @click.stop
          />
        </template>
        
        <v-list density="compact">
          <v-list-item
            prepend-icon="mdi-eye"
            title="View Project"
            @click="$emit('click')"
          />
          <v-list-item
            prepend-icon="mdi-pencil"
            title="Edit Project"
            @click="editProject"
          />
          <v-list-item
            prepend-icon="mdi-content-duplicate"
            title="Duplicate"
            @click="duplicateProject"
          />
          <v-divider />
          <v-list-item
            prepend-icon="mdi-trash-can"
            title="Delete"
            class="text-error"
            @click="$emit('delete')"
          />
        </v-list>
      </v-menu>
    </v-card-title>

    <!-- Card Content -->
    <v-card-text class="card-content">
      <!-- Description -->
      <p class="project-description">
        {{ project.description || 'No description provided' }}
      </p>

      <!-- Status Badge -->
      <div class="status-section">
        <v-chip
          :color="getStatusColor(project.status)"
          :prepend-icon="getStatusIcon(project.status)"
          size="small"
          variant="tonal"
          class="status-chip"
        >
          {{ project.status.charAt(0).toUpperCase() + project.status.slice(1) }}
        </v-chip>
      </div>

      <!-- Project Stats -->
      <div class="project-stats">
        <div class="stat-item">
          <v-icon icon="mdi-clock-outline" size="16" class="me-1" />
          <span class="text-caption">{{ formatDate(project.updated_at) }}</span>
        </div>
        
        <div v-if="project.training_jobs?.length" class="stat-item">
          <v-icon icon="mdi-brain" size="16" class="me-1" />
          <span class="text-caption">{{ project.training_jobs.length }} job{{ project.training_jobs.length !== 1 ? 's' : '' }}</span>
        </div>
        
        <div v-if="project.model_versions?.length" class="stat-item">
          <v-icon icon="mdi-package-variant" size="16" class="me-1" />
          <span class="text-caption">{{ project.model_versions.length }} version{{ project.model_versions.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Deployment Status -->
      <div v-if="hasDeployedModel" class="deployment-status">
        <v-chip
          color="success"
          prepend-icon="mdi-rocket"
          size="small"
          variant="flat"
          class="deployment-chip"
        >
          Live Deployment
        </v-chip>
      </div>
    </v-card-text>

    <!-- Quick Actions -->
    <v-card-actions class="card-actions">
      <v-btn
        v-if="project.status === 'draft'"
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-play"
        @click.stop="startProject"
      >
        Start
      </v-btn>
      
      <v-btn
        v-else-if="project.status === 'active'"
        color="info"
        variant="tonal"
        size="small"
        prepend-icon="mdi-brain"
        @click.stop="viewTraining"
      >
        Training
      </v-btn>
      
      <v-btn
        v-else-if="hasDeployedModel"
        color="success"
        variant="tonal"
        size="small"
        prepend-icon="mdi-open-in-new"
        @click.stop="openDeployment"
      >
        Open
      </v-btn>

      <v-spacer />
      
      <v-btn
        variant="text"
        size="small"
        @click.stop="$emit('click')"
      >
        View Details
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '~/types/project'
import { useIcons } from '~/composables/useIcons'

// Props
interface Props {
  project: Project
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
const emit = defineEmits<{
  click: []
  delete: []
}>()

// Composables
const { getIcon, getIconColor } = useIcons()

// Computed
const hasDeployedModel = computed(() => {
  return props.project.model_versions?.some(version => version.deployed) || false
})

// Methods
const getProjectIcon = (type: string) => {
  return getIcon('project', type)
}

const getProjectColor = (type: string) => {
  return getIconColor(type)
}

const getStatusIcon = (status: string) => {
  return getIcon('status', status)
}

const getStatusColor = (status: string) => {
  const colorMap = {
    draft: 'grey',
    active: 'success',
    training: 'info',
    deployed: 'primary',
    completed: 'success',
    error: 'error',
    archived: 'grey-darken-1',
    paused: 'warning'
  }
  return colorMap[status as keyof typeof colorMap] || 'grey'
}

const getProjectTypeLabel = (type: string) => {
  const labels = {
    classification: 'Classification',
    regression: 'Regression',
    clustering: 'Clustering',
    nlp: 'Natural Language Processing',
    cv: 'Computer Vision',
    recommendation: 'Recommendation System',
    'time-series': 'Time Series Forecasting',
    custom: 'Custom Pipeline'
  }
  return labels[type as keyof typeof labels] || type
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}

const editProject = () => {
  navigateTo(`/projects/${props.project.id}/config`)
}

const duplicateProject = () => {
  console.log('Duplicate project:', props.project.name)
}

const startProject = () => {
  navigateTo(`/projects/${props.project.id}`)
}

const viewTraining = () => {
  navigateTo(`/projects/${props.project.id}/train`)
}

const openDeployment = () => {
  const deployedVersion = props.project.model_versions?.find(v => v.deployed)
  if (deployedVersion?.endpoint_url) {
    window.open(deployedVersion.endpoint_url, '_blank')
  }
}
</script>

<style scoped>
.project-card {
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.project-card--loading {
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.card-header {
  padding: 20px 20px 16px 20px;
}

.header-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.project-info {
  min-width: 0;
  flex: 1;
}

.project-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-type {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0;
  opacity: 0.8;
}

.card-menu-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.project-card:hover .card-menu-btn {
  opacity: 1;
}

.card-content {
  padding: 0 20px 16px 20px;
}

.project-description {
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6em;
}

.status-section {
  margin-bottom: 16px;
}

.project-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
}

.deployment-status {
  margin-top: 8px;
}

.card-actions {
  padding: 16px 20px 20px 20px;
  border-top: 1px solid rgba(var(--v-theme-outline), 0.12);
}

@media (max-width: 768px) {
  .project-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .card-header,
  .card-content,
  .card-actions {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
