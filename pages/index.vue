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
                    <v-icon start>mdi-robot</v-icon>
                    AI-Powered
                  </v-chip>
                  <v-chip color="success" variant="outlined" size="small">
                    <v-icon start>mdi-lightning-bolt</v-icon>
                    Low-Code
                  </v-chip>
                  <v-chip color="warning" variant="outlined" size="small">
                    <v-icon start>mdi-chart-line</v-icon>
                    Analytics
                  </v-chip>
                </v-chip-group>
              </v-card-text>
            </v-card>

            <!-- Statistics Overview -->
            <v-row class="mb-6">
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
                      {{ bots.length }}
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
                      {{ models.length }}
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
                      {{ pipelineSteps }}
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
                      {{ projectCount }}
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
                      <ProjectListPreview />
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
                      <ActivityFeed />
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ActivityFeed from '~/components/activity-feed.vue'
import ProjectListPreview from '~/components/project-list-preview.vue'
import { useSupabase } from '~/composables/supabase'
import { useAuth } from '~/composables/useAuth'
import { useBotStore } from '~/stores/botStore'
import { useModelStore } from '~/stores/modelStore'
import { usePipelineStore } from '~/stores/pipelineStore'

const drawer = ref(false)
const { user } = useAuth()
const botStore = useBotStore()
const modelStore = useModelStore()
const pipelineStore = usePipelineStore()

const bots = computed(() => botStore.bots || [])
const models = computed(() => modelStore.models || [])
const pipelineSteps = computed(() => pipelineStore.pipelines?.length || 0)
const projectCount = ref(0)

const toggleDrawer = () => {
  drawer.value = !drawer.value
}

onMounted(async () => {
  try {
    await botStore.fetchAll()
    await pipelineStore.fetchAll() // Add this line to fetch pipelines
    // For models, you may want to fetch from backend if not already loaded
    // For projects, fetch count
    const supabase = useSupabase()
    const { data, error } = await supabase.from('projects').select('id')
    if (error) {
      // Failed to fetch projects - could be logged to a proper logging service
      // console.warn('Failed to fetch projects:', error.message)
      projectCount.value = 0
    } else {
      projectCount.value = data ? data.length : 0
    }
  } catch (error) {
    // Error during page initialization - could be logged to a proper logging service
    // console.warn('Error during page initialization:', error)
    // Set default values if Supabase is not available
    projectCount.value = 0
  }
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
