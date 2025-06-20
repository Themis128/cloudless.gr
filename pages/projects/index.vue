<template>
  <div class="projects-page">
    <!-- Page Header -->
    <div class="page-header">
      <v-container>
        <!-- Welcome Section -->
        <v-row v-if="userName" class="mb-4">
          <v-col cols="12">
            <div class="welcome-section">
              <div class="d-flex align-center">
                <v-avatar v-if="userStore.user.avatar_url" size="60" class="me-4">
                  <v-img :src="userStore.user.avatar_url" :alt="userName" />
                </v-avatar>
                <v-avatar
                  v-else
                  size="60"
                  color="primary"
                  class="me-4"
                >
                  <span class="text-h5 font-weight-bold">{{ userInitials }}</span>
                </v-avatar>
                <div>
                  <h2 class="welcome-title">Welcome back, {{ userName }}!</h2>
                  <p class="welcome-subtitle">{{ personalizedWelcomeMessage }}</p>
                </div>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- Main Header -->
        <v-row align="center" justify="space-between">
          <v-col cols="12" md="8">
            <h1 class="page-title">
              <v-icon icon="mdi-folder-multiple" class="me-3" />
              {{ userName ? 'Your Projects' : 'My Projects' }}
            </h1>
            <p class="page-subtitle">{{ personalizedSubtitle }}</p>
          </v-col>
          <v-col cols="12" md="4" class="text-right">
            <v-btn
              color="primary"
              size="large"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
            >
              Create Project
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- Quick Stats -->
    <div class="stats-section">
      <v-container>
        <div v-if="userName" class="stats-header mb-4">
          <h3 class="stats-title">{{ userName }}'s Project Overview</h3>
          <p class="stats-description">{{ personalizedStatsDescription }}</p>
        </div>
        <v-row>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stats-card text-center" elevation="4">
              <v-card-text>
                <div class="stats-icon">
                  <v-icon icon="mdi-folder-multiple" size="40" />
                </div>
                <h3 class="stats-number">{{ filteredProjects.length }}</h3>
                <p class="stats-label">
                  {{ filteredProjects.length === 1 ? 'Project' : 'Total Projects' }}
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stats-card text-center" elevation="4">
              <v-card-text>
                <div class="stats-icon">
                  <v-icon icon="mdi-play-circle" size="40" />
                </div>
                <h3 class="stats-number">{{ activeProjects }}</h3>
                <p class="stats-label">Active</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stats-card text-center" elevation="4">
              <v-card-text>
                <div class="stats-icon">
                  <v-icon icon="mdi-brain" size="40" />
                </div>
                <h3 class="stats-number">{{ trainingProjects }}</h3>
                <p class="stats-label">Training</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stats-card text-center" elevation="4">
              <v-card-text>
                <div class="stats-icon">
                  <v-icon icon="mdi-cloud-upload" size="40" />
                </div>
                <h3 class="stats-number">{{ deployedProjects }}</h3>
                <p class="stats-label">Deployed</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- Projects List -->
    <div class="projects-section">
      <v-container>
        <ProjectList
          :projects="filteredProjects as any"
          :view-mode="viewMode"
          :loading="loading"
          @project-click="handleProjectClick"
          @project-delete="handleProjectDelete"
        />

        <!-- Empty State -->
        <div v-if="!loading && filteredProjects.length === 0" class="empty-state">
          <v-card class="text-center pa-8" elevation="2">
            <v-icon icon="mdi-folder-plus" size="80" color="grey-lighten-1" />
            <h2 class="mt-4 mb-2">
              {{ userName ? `${userName}, you're ready to start!` : 'No Projects Yet' }}
            </h2>
            <p class="text-body-1 mb-4">
              {{ personalizedEmptyMessage }}
            </p>
            <v-btn
              color="primary"
              size="large"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
            >
              {{ userName ? `Create ${userName}'s First Project` : 'Create Your First Project' }}
            </v-btn>
          </v-card>
        </div>
      </v-container>
    </div>

    <!-- Training Progress Section -->
    <div v-if="hasActiveTraining" class="training-section">
      <v-container>
        <h2 class="section-title mb-4">
          <v-icon icon="mdi-brain" class="me-2" />
          Active Training
        </h2>
        <!-- Show simple training status instead of complex component -->
        <v-card v-for="project in trainingProjectsList" :key="project.id" class="mb-4">
          <v-card-title>{{ project.name }}</v-card-title>
          <v-card-text>
            <p>Status: {{ project.status }}</p>
            <v-btn color="error" size="small" @click="handleStopTraining(project.id)">
              Stop Training
            </v-btn>
          </v-card-text>
        </v-card>
      </v-container>
    </div>

    <!-- Recent Deployments -->
    <div v-if="hasDeployments" class="deployments-section">
      <v-container>
        <h2 class="section-title mb-4">
          <v-icon icon="mdi-rocket-launch" class="me-2" />
          Recent Deployments
        </h2>
        <DeploymentStatusList
          :deployments="recentDeployments"
          @view-logs="handleViewLogs"
          @restart-deployment="handleRestartDeployment"
        />
      </v-container>
    </div>

    <!-- Create Project Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="800" persistent>
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Create New Project</span>
          <v-btn
            icon="mdi-close"
            variant="text"
            color="blue"
            @click="showCreateDialog = false"
          />
        </v-card-title>
        <v-card-text>
          <ProjectCreateForm @submit="handleCreateProject" @cancel="showCreateDialog = false" />
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Loading Overlay -->
    <v-overlay v-model="loading" class="align-center justify-center">
      <v-progress-circular indeterminate size="64" />
    </v-overlay>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'projects' })
import { useProjectsStore } from '@/stores/projectsStore';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

// Import components
import DeploymentStatusList from '@/components/projects/DeploymentStatusList.vue';
import ProjectCreateForm from '@/components/projects/ProjectCreateForm.vue';
import ProjectList from '@/components/projects/ProjectList.vue';



// Stores
const projectStore = useProjectsStore();
const userStore = useUserStore();
const router = useRouter();

// Reactive data
const viewMode = ref<'grid' | 'list'>('grid');
const showCreateDialog = ref(false);

// Computed properties
const userName = computed(() => {
  const fullName = userStore.user.full_name;
  if (fullName) {
    return fullName.split(' ')[0]; // First name only
  }
  return '';
});

const userInitials = computed(() => {
  const fullName = userStore.user.full_name;
  if (fullName) {
    return fullName
      .split(' ')
      .map((name) => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return userStore.user.email?.charAt(0).toUpperCase() || 'U';
});

const personalizedWelcomeMessage = computed(() => {
  const projectCount = filteredProjects.value.length;
  const activeCount = activeProjects.value;

  if (projectCount === 0) {
    return 'Ready to start your AI development journey?';
  } else if (activeCount > 0) {
    return `You have ${activeCount} active project${activeCount > 1 ? 's' : ''} in progress.`;
  } else {
    return `Managing ${projectCount} project${projectCount > 1 ? 's' : ''} like a pro!`;
  }
});

const personalizedSubtitle = computed(() => {
  const userRole = userStore.user.role;
  if (userRole === 'admin') {
    return 'Manage and oversee all AI development projects and training pipelines';
  }
  return 'Manage your AI development projects and training pipelines';
});

const personalizedEmptyMessage = computed(() => {
  const userRole = userStore.user.role;
  if (userRole === 'admin') {
    return 'As an admin, you can create and manage AI projects for your team. Start by creating your first project to get everyone started with model training and deployment.';
  }
  return 'Create your first AI project to get started with model training and deployment. Every great AI journey begins with a single project!';
});

const personalizedStatsDescription = computed(() => {
  const projectCount = filteredProjects.value.length;
  if (projectCount === 0) {
    return 'Your project dashboard is ready for your first AI project.';
  } else if (projectCount === 1) {
    return 'Keep up the great work with your AI project!';
  } else {
    return `You're managing ${projectCount} projects efficiently. Great job!`;
  }
});

const filteredProjects = computed(() => {
  const projects = (projectStore as any).projects || [];
  return [...projects];
});

const activeProjects = computed(() => {
  const projects = (projectStore as any).projects || [];
  return projects.filter((p: any) => p.status === 'active').length;
});

const trainingProjects = computed(() => {
  const projects = (projectStore as any).projects || [];
  return projects.filter((p: any) => p.status === 'training').length;
});

const deployedProjects = computed(() => {
  const projects = (projectStore as any).projects || [];
  return projects.filter((p: any) => p.status === 'deployed').length;
});

const trainingProjectsList = computed(() => {
  const projects = (projectStore as any).projects || [];
  return projects.filter((p: any) => p.status === 'training');
});

const hasActiveTraining = computed(() => trainingProjectsList.value.length > 0);

// Loading state
const loading = computed(() => projectStore.loading);

const recentDeployments = computed(() => {
  // Mock deployment data - replace with actual data from your store
  const projects = (projectStore as any).projects || [];
  return projects
    .filter((p: any) => p.status === 'deployed')
    .slice(0, 5)
    .map((project: any) => ({
      id: project.id,
      project_name: project.name,
      deployment_name: project.name,
      status: 'running',
      url: `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.cloudless.gr`,
      deployed_at: new Date().toISOString(),
      version: '1.0.0',
      environment: 'production' as const,
      instance_type: 'standard',
      cpu_limit: 1000,
      memory_limit: 2048,
      project_id: project.id,
      created_at: new Date().toISOString(),
      auto_scaling: false,
      updated_at: new Date().toISOString(),
    }));
});

const hasDeployments = computed(() => recentDeployments.value.length > 0);

// Methods
const handleProjectClick = (project: any) => {
  router.push(`/projects/${project.id}`);
};

const handleProjectDelete = async (projectId: string) => {
  try {
    await projectStore.deleteProject(projectId);
    // Show success message
  } catch (error) {
    console.error('Failed to delete project:', error);
    // Show error message
  }
};

const handleCreateProject = async (projectData: any) => {
  try {
    await projectStore.createProject(projectData);
    showCreateDialog.value = false;
    // Show success message
  } catch (error) {
    console.error('Failed to create project:', error);
    // Show error message
  }
};

const handlePauseTraining = async (projectId: string) => {
  try {
    // This would need to find and stop the active training session
    // Show success message
  } catch (error) {
    console.error('Failed to pause training:', error);
    // Show error message
  }
};

const handleResumeTraining = async (projectId: string) => {
  try {
    // This would need to restart training - implement based on your requirements
    // Show success message
  } catch (error) {
    console.error('Failed to resume training:', error);
    // Show error message
  }
};

const handleStopTraining = async (projectId: string) => {
  try {
    // This would need to find and stop the active training session
    // Show success message
  } catch (error) {
    console.error('Failed to stop training:', error);
    // Show error message
  }
};

const handleViewLogs = (deployment: any) => {
  router.push(`/projects/deployments/${deployment.id}/logs`);
};

const handleRestartDeployment = async (deployment: any) => {
  try {
    // await deploymentStore.restartDeployment(deployment.id)
    // Show success message
  } catch (error) {
    console.error('Failed to restart deployment:', error);
    // Show error message
  }
};

// Lifecycle
onMounted(async () => {
  // Fetch user profile for personalization
  await userStore.fetchUserProfile();

  // Fetch projects if not already loaded
  const projects = (projectStore as any).projects || [];
  if (projects.length === 0) {
    await projectStore.fetchProjects();
  }
});
</script>

<style scoped>
.projects-page {
  min-height: 100vh;
}

/* Page Header */
.page-header {
  padding: 2rem 0;
  margin-bottom: 1rem;
}

/* Welcome Section */
.welcome-section {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.welcome-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  margin-bottom: 0.25rem;
}

.welcome-subtitle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
  font-weight: 400;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
}

/* Stats Section */
.stats-section {
  margin-bottom: 2rem;
}

.stats-header {
  text-align: center;
}

.stats-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  margin-bottom: 0.5rem;
}

.stats-description {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
}

.stats-card {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.9) 0%,
    rgba(var(--v-theme-primary-darken-1), 0.95) 100%
  ) !important;
  color: white !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.stats-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(var(--v-theme-primary), 0.4) !important;
}

.stats-icon {
  margin-bottom: 1rem;
  opacity: 0.9;
}

.stats-number {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.stats-label {
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.9;
  margin: 0;
}

/* Projects Section */
.projects-section {
  margin-bottom: 3rem;
}

.empty-state {
  margin: 3rem 0;
}

.empty-state .v-card {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Training Section */
.training-section {
  margin-bottom: 3rem;
  padding: 2rem 0;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Deployments Section */
.deployments-section {
  margin-bottom: 3rem;
  padding: 2rem 0;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
}

/* Dialog Enhancements */
.v-dialog .v-card {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Form Controls */
.v-text-field {
  background: rgba(255, 255, 255, 0.95);
}

.v-btn-toggle {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .page-title {
    font-size: 2rem;
  }

  .page-subtitle {
    font-size: 1rem;
  }

  .stats-number {
    font-size: 2rem;
  }

  .controls-section .text-right {
    text-align: left !important;
    margin-top: 1rem;
  }

  .training-section,
  .deployments-section {
    padding: 1rem 0;
  }
}

/* Stats cards white text */
.stats-card :deep(*) {
  color: white !important;
}

/* Empty state card - dark text on white background */
.empty-state .v-card :deep(.v-card-title),
.empty-state .v-card :deep(.v-card-text),
.empty-state .v-card :deep(.v-list-item-title),
.empty-state .v-card :deep(.v-list-item-subtitle),
.empty-state .v-card :deep(*) {
  color: rgba(0, 0, 0, 0.87) !important;
}

/* Training and deployment section cards - white text on dark glassmorphism */
.training-section .v-card,
.deployments-section .v-card {
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.training-section .v-card :deep(.v-card-title),
.training-section .v-card :deep(.v-card-text),
.training-section .v-card :deep(.v-list-item-title),
.training-section .v-card :deep(.v-list-item-subtitle),
.training-section .v-card :deep(p) {
  color: rgba(255, 255, 255, 0.95) !important;
}

.deployments-section .v-card :deep(.v-card-title),
.deployments-section .v-card :deep(.v-card-text),
.deployments-section .v-card :deep(.v-list-item-title),
.deployments-section .v-card :deep(.v-list-item-subtitle),
.deployments-section .v-card :deep(p) {
  color: rgba(255, 255, 255, 0.95) !important;
}

/* Dialog cards - dark text on white background */
.v-dialog .v-card :deep(.v-card-title),
.v-dialog .v-card :deep(.v-card-text),
.v-dialog .v-card :deep(.v-list-item-title),
.v-dialog .v-card :deep(.v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.87) !important;
}

/* Ensure proper contrast for form elements */
:deep(.v-field--variant-outlined) {
  background: rgba(255, 255, 255, 0.95);
}

:deep(.v-field--variant-filled) {
  background: rgba(255, 255, 255, 0.9);
}
</style>
