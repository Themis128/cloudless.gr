<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon class="sandwich-menu-icon" size="large" @click="toggleDrawer" />
      <v-app-bar-title>Cloudless LLM Dev Agent</v-app-bar-title>
    </v-app-bar>
    <ClientOnly>
      <v-navigation-drawer v-model="drawer" app class="navigation-drawer">
        <v-list class="menu-list">
          <v-list-item to="/" title="Home" prepend-icon="mdi-home" />
          <v-list-item to="/bots" title="Bots" prepend-icon="mdi-robot" />
          <v-list-item to="/models" title="Models" prepend-icon="mdi-brain" />
          <v-list-item to="/pipelines" title="Pipelines" prepend-icon="mdi-timeline" />
          <v-list-item to="/projects/create" title="Create Project" prepend-icon="mdi-plus-box" />
          <v-list-item to="/llm" title="LLM Overview" prepend-icon="mdi-brain" />
          <v-list-item to="/llm/models" title="LLM Models" prepend-icon="mdi-brain" />
          <v-list-item to="/llm/training" title="LLM Training" prepend-icon="mdi-school" />
          <v-list-item to="/llm/datasets" title="LLM Datasets" prepend-icon="mdi-database" />
          <v-list-item to="/llm/analytics" title="LLM Analytics" prepend-icon="mdi-chart-line" />
          <v-list-item to="/llm/api" title="LLM API Docs" prepend-icon="mdi-api" />
          <v-list-item to="/debug" title="Debug" prepend-icon="mdi-bug" />
          <v-list-item to="/test-error" title="Test Errors" prepend-icon="mdi-alert-circle" />
        </v-list>
      </v-navigation-drawer>
    </ClientOnly>
    <v-main>
      <v-container fluid>
        <v-row class="my-6" align="stretch">
          <!-- Main Dashboard Content -->
          <v-col cols="12">
            <!-- Welcome Header -->
            <v-card class="bg-white mb-6" elevation="2">
              <v-card-title class="d-flex align-center text-h4">
                <v-icon class="me-3" color="primary" size="36">
                  mdi-view-dashboard
                </v-icon>
                <span>Welcome{{
                  user && user.email ? `, ${user.email}` : ''
                }}!</span>
              </v-card-title>
              <v-card-text class="text-body-1">
                <div class="mb-3">
                  Your all-in-one low-code platform for data pipelines, analytics, and AI.
                </div>
                <v-chip-group>
                  <v-chip color="primary" variant="outlined" size="small">
                    <v-icon start>
                      mdi-robot
                    </v-icon>
                    AI-Powered
                  </v-chip>
                  <v-chip color="success" variant="outlined" size="small">
                    <v-icon start>
                      mdi-lightning-bolt
                    </v-icon>
                    Low-Code
                  </v-chip>
                  <v-chip color="warning" variant="outlined" size="small">
                    <v-icon start>
                      mdi-chart-line
                    </v-icon>
                    Analytics
                  </v-chip>
                </v-chip-group>
              </v-card-text>
            </v-card>

            <!-- Gradient Card Example -->
            <GradientCard variant="primary" class="mb-6">
              <div class="text-center">
                <h3 class="text-h5 mb-2">✨ Enhanced Dashboard</h3>
                <p class="text-body-1">Your dashboard is now fully synced with Supabase and displays real-time data!</p>
              </div>
            </GradientCard>

            <!-- Loading State -->
            <v-row v-if="isLoading" class="mb-6">
              <v-col cols="12">
                <v-card class="bg-white" elevation="2">
                  <v-card-text class="text-center">
                    <v-progress-circular indeterminate color="primary" size="64" />
                    <div class="mt-4 text-h6">Loading dashboard data...</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Error State -->
            <v-row v-if="error" class="mb-6">
              <v-col cols="12">
                <v-alert type="error" variant="tonal" class="mb-4">
                  <template #title>Error Loading Dashboard</template>
                  {{ error }}
                  <template #append>
                    <v-btn color="primary" variant="text" @click="fetchAllData">
                      Retry
                    </v-btn>
                  </template>
                </v-alert>
              </v-col>
            </v-row>

            <!-- Statistics Overview -->
            <v-row v-if="!isLoading && !error" class="mb-6">
              <v-row>
                <v-col cols="12" sm="6" md="3">
                  <v-card class="bg-white stats-card" elevation="2">
                    <v-card-title class="d-flex align-center text-h6">
                      <v-icon class="me-2" color="primary">
                        mdi-robot
                      </v-icon>
                      Bots
                    </v-card-title>
                    <v-card-text class="text-h3 font-weight-bold text-primary">
                      {{ stats.bots }}
                    </v-card-text>
                    <v-card-subtitle class="text-caption">
                      Active AI assistants
                    </v-card-subtitle>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-card class="bg-white stats-card" elevation="2">
                    <v-card-title class="d-flex align-center text-h6">
                      <v-icon class="me-2" color="success">
                        mdi-brain
                      </v-icon>
                      Models
                    </v-card-title>
                    <v-card-text class="text-h3 font-weight-bold text-success">
                      {{ stats.models }}
                    </v-card-text>
                    <v-card-subtitle class="text-caption">
                      Trained AI models
                    </v-card-subtitle>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-card class="bg-white stats-card" elevation="2">
                    <v-card-title class="d-flex align-center text-h6">
                      <v-icon class="me-2" color="warning">
                        mdi-timeline
                      </v-icon>
                      Pipelines
                    </v-card-title>
                    <v-card-text class="text-h3 font-weight-bold text-warning">
                      {{ stats.pipelines }}
                    </v-card-text>
                    <v-card-subtitle class="text-caption">
                      Data processing workflows
                    </v-card-subtitle>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-card class="bg-white stats-card" elevation="2">
                    <v-card-title class="d-flex align-center text-h6">
                      <v-icon class="me-2" color="info">
                        mdi-folder
                      </v-icon>
                      Projects
                    </v-card-title>
                    <v-card-text class="text-h3 font-weight-bold text-info">
                      {{ stats.projects }}
                    </v-card-text>
                    <v-card-subtitle class="text-caption">
                      Active projects
                    </v-card-subtitle>
                  </v-card>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12" md="6">
                  <v-card class="bg-white" elevation="2">
                    <v-card-title class="d-flex align-center">
                      <v-icon class="me-2" color="primary">
                        mdi-folder-multiple
                      </v-icon>
                      Recent Projects
                    </v-card-title>
                    <v-card-text>
                      <div v-if="recentProjects.length === 0" class="text-center pa-4">
                        <v-icon size="48" color="grey-lighten-1">mdi-folder-open</v-icon>
                        <div class="text-h6 mt-2 text-grey">No projects yet</div>
                        <div class="text-body-2 text-grey-lighten-1">Create your first project to get started</div>
                        <v-btn color="primary" class="mt-4" to="/projects/create">
                          Create Project
                        </v-btn>
                      </div>
                      <div v-else>
                        <v-list>
                          <v-list-item
                            v-for="project in recentProjects"
                            :key="project.id"
                            :to="`/projects/${project.id}`"
                            class="mb-2"
                          >
                            <template #prepend>
                              <v-icon :color="getProjectStatusColor(project.status)">
                                mdi-folder
                              </v-icon>
                            </template>
                            <v-list-item-title>{{ project.name }}</v-list-item-title>
                            <v-list-item-subtitle>
                              {{ project.description || 'No description' }}
                            </v-list-item-subtitle>
                            <template #append>
                              <v-chip size="small" :color="getProjectStatusColor(project.status)" variant="outlined">
                                {{ project.status || 'draft' }}
                              </v-chip>
                            </template>
                          </v-list-item>
                        </v-list>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card class="bg-white" elevation="2">
                    <v-card-title class="d-flex align-center">
                      <v-icon class="me-2" color="success">
                        mdi-clock-outline
                      </v-icon>
                      Recent Activity
                    </v-card-title>
                    <v-card-text>
                      <div v-if="recentActivity.length === 0" class="text-center pa-4">
                        <v-icon size="48" color="grey-lighten-1">mdi-clock-outline</v-icon>
                        <div class="text-h6 mt-2 text-grey">No recent activity</div>
                        <div class="text-body-2 text-grey-lighten-1">Start creating bots, models, or pipelines to see activity here</div>
                      </div>
                      <div v-else>
                        <v-list>
                          <v-list-item
                            v-for="activity in recentActivity"
                            :key="activity.id"
                            class="mb-2"
                          >
                            <template #prepend>
                              <v-icon :color="activity.color">
                                {{ activity.icon }}
                              </v-icon>
                            </template>
                            <v-list-item-title>{{ activity.title }}</v-list-item-title>
                            <v-list-item-subtitle>{{ activity.description }}</v-list-item-subtitle>
                            <template #append>
                              <v-chip size="small" color="grey" variant="outlined">
                                {{ formatTimeAgo(activity.created_at) }}
                              </v-chip>
                            </template>
                          </v-list-item>
                        </v-list>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useDashboard } from '~/composables/useDashboard'
import GradientCard from '~/components/ui/GradientCard.vue'

const drawer = ref(false)
const { user } = useAuth()
const { 
  isLoading, 
  error, 
  stats, 
  recentProjects, 
  recentActivity, 
  fetchAllData 
} = useDashboard()

const toggleDrawer = () => {
  drawer.value = !drawer.value
}

const getProjectStatusColor = (status: string | null) => {
  switch (status) {
    case 'active': return 'success'
    case 'training': return 'warning'
    case 'deployed': return 'info'
    case 'completed': return 'success'
    case 'error': return 'error'
    case 'archived': return 'grey'
    case 'paused': return 'orange'
    default: return 'grey'
  }
}

const formatTimeAgo = (dateString: string | null) => {
  if (!dateString) return 'Unknown'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`
}

  onMounted(async () => {
    await fetchAllData()
  })
</script>

<style scoped>
.sandwich-menu-icon {
  font-size: 28px !important;
  color: white !important;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
  margin-right: 8px;
  transition: all 0.3s ease;
}

.sandwich-menu-icon:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Make the hamburger lines more visible */
.sandwich-menu-icon :deep(.v-icon) {
  font-size: 28px !important;
  color: white !important;
  font-weight: bold;
}

/* Ensure the icon is always visible */
.sandwich-menu-icon :deep(svg) {
  width: 28px !important;
  height: 28px !important;
  stroke-width: 2px;
}

/* Make menu text and icons black */
.navigation-drawer {
  background-color: white !important;
}

.menu-list :deep(.v-list-item) {
  color: black !important;
}

.menu-list :deep(.v-list-item .v-list-item-title) {
  color: black !important;
  font-weight: 500;
}

.menu-list :deep(.v-list-item .v-icon) {
  color: black !important;
}

/* Active/selected menu item styling */
.menu-list :deep(.v-list-item--active) {
  background-color: rgba(0, 0, 0, 0.05) !important;
}

.menu-list :deep(.v-list-item--active .v-list-item-title) {
  color: black !important;
  font-weight: 600;
}

.menu-list :deep(.v-list-item--active .v-icon) {
  color: black !important;
}

/* Hover effects */
.menu-list :deep(.v-list-item:hover) {
  background-color: rgba(0, 0, 0, 0.03) !important;
}

.menu-list :deep(.v-list-item:hover .v-list-item-title) {
  color: black !important;
}

.menu-list :deep(.v-list-item:hover .v-icon) {
  color: black !important;
}

/* Enhanced card styling */
.stats-card {
  transition: all 0.3s ease;
  border-radius: 12px !important;
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.stats-card .v-card-title {
  font-weight: 600;
  color: #333;
}

.stats-card .v-card-text {
  padding-top: 8px;
  padding-bottom: 8px;
}

.stats-card .v-card-subtitle {
  padding-top: 0;
  color: #666;
  font-size: 0.75rem;
}

/* Card content improvements */
.v-card {
  border-radius: 12px !important;
  transition: all 0.3s ease;
}

.v-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

.v-card .v-card-title {
  font-weight: 600;
  color: #333;
}

/* Action button styling */
.action-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
}
</style>
