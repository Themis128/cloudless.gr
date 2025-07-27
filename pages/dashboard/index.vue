<template>
  <v-container fluid class="dashboard-container">
    <!-- Header Section -->
    <v-row>
      <v-col cols="12">
        <v-card class="dashboard-header-card" elevation="0">
          <v-card-title class="text-h4 font-weight-bold text-primary">
            <v-icon size="32" class="mr-3">mdi-view-dashboard</v-icon>
            Dashboard
          </v-card-title>
          <v-card-subtitle class="text-body-1">
            Welcome to your Cloudless Wizard dashboard. Monitor your projects,
            AI models, and system performance.
          </v-card-subtitle>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading State -->
    <v-row v-if="isLoading">
      <v-col cols="12" class="text-center">
        <v-progress-circular
          indeterminate
          color="primary"
          size="64"
        ></v-progress-circular>
        <div class="mt-4 text-h6">Loading dashboard data...</div>
      </v-col>
    </v-row>

    <!-- Error State -->
    <v-row v-else-if="error">
      <v-col cols="12">
        <v-alert type="error" variant="tonal" :text="error" class="mb-4">
          <template v-slot:append>
            <v-btn
              color="error"
              variant="text"
              @click="() => $fetch('/api/stats/dashboard')"
              prepend-icon="mdi-refresh"
            >
              Retry
            </v-btn>
          </template>
        </v-alert>
      </v-col>
    </v-row>

    <!-- Dashboard Content -->
    <v-row v-else>
      <!-- Stats Cards -->
      <v-col cols="12" md="4">
        <v-card class="stat-card" elevation="2">
          <v-card-text class="text-center">
            <v-icon size="48" color="primary" class="mb-3"
              >mdi-folder-multiple</v-icon
            >
            <div class="text-h3 font-weight-bold text-primary">
              {{ stats.projects }}
            </div>
            <div class="text-subtitle-1 text-medium-emphasis">
              Total Projects
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="stat-card" elevation="2">
          <v-card-text class="text-center">
            <v-icon size="48" color="success" class="mb-3"
              >mdi-account-group</v-icon
            >
            <div class="text-h3 font-weight-bold text-success">
              {{ stats.users }}
            </div>
            <div class="text-subtitle-1 text-medium-emphasis">Active Users</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="stat-card" elevation="2">
          <v-card-text class="text-center">
            <v-icon size="48" color="info" class="mb-3">mdi-chart-line</v-icon>
            <div class="text-h3 font-weight-bold text-info">
              {{ stats.active }}
            </div>
            <div class="text-subtitle-1 text-medium-emphasis">
              Active Projects
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Recent Activity -->
      <v-col cols="12" lg="8">
        <v-card class="activity-card" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon size="24" class="mr-2">mdi-clock-outline</v-icon>
            Recent Activity
          </v-card-title>
          <v-card-text>
            <v-list v-if="recentActivity.length > 0" class="activity-list">
              <v-list-item
                v-for="activity in recentActivity"
                :key="activity.id"
                class="activity-item"
              >
                <template v-slot:prepend>
                  <v-avatar
                    :color="getActivityColor(activity.type)"
                    size="32"
                    class="mr-3"
                  >
                    <v-icon size="16" color="white">
                      {{ getActivityIcon(activity.type) }}
                    </v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="text-body-1">
                  {{ activity.text }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ formatTimestamp(activity.timestamp) }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4"
                >mdi-inbox-outline</v-icon
              >
              <div class="text-h6 text-grey">No recent activity</div>
              <div class="text-body-2 text-grey-lighten-1">
                Start creating projects to see activity here
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Quick Actions -->
      <v-col cols="12" lg="4">
        <v-card class="quick-actions-card" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon size="24" class="mr-2">mdi-lightning-bolt</v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-list class="quick-actions-list">
              <v-list-item
                v-for="action in quickActions"
                :key="action.title"
                :to="action.route"
                class="quick-action-item"
                link
              >
                <template v-slot:prepend>
                  <v-avatar :color="action.color" size="40" class="mr-3">
                    <v-icon size="20" color="white">
                      {{ action.icon }}
                    </v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="text-body-1 font-weight-medium">
                  {{ action.title }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ action.description }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Stats {
  projects: number
  users: number
  active: number
}

interface Activity {
  id: string
  text: string
  timestamp: Date
  type: 'project' | 'user' | 'bot' | 'model'
}

interface QuickAction {
  title: string
  description: string
  icon: string
  color: string
  route: string
}

const isLoading = ref(true)
const error = ref('')
const stats = ref<Stats>({ projects: 0, users: 0, active: 0 })
const recentActivity = ref<Activity[]>([])

const quickActions: QuickAction[] = [
  {
    title: 'Create Project',
    description: 'Start a new development project',
    icon: 'mdi-folder-plus',
    color: 'primary',
    route: '/projects',
  },
  {
    title: 'Deploy Bot',
    description: 'Deploy an AI bot to production',
    icon: 'mdi-robot',
    color: 'success',
    route: '/bots',
  },
  {
    title: 'Train Model',
    description: 'Train a new AI model',
    icon: 'mdi-brain',
    color: 'info',
    route: '/models',
  },
  {
    title: 'View Analytics',
    description: 'Check system performance',
    icon: 'mdi-chart-line',
    color: 'warning',
    route: '/llm/analytics',
  },
]

const { data: statsData, error: statsError } = await useFetch<Stats>(
  '/api/stats/dashboard',
  {
    default: () => ({ totalUsers: 0, totalBots: 0, totalPipelines: 0 })
  }
)
const { data: activityData, error: activityError } = await useFetch<Activity[]>(
  '/api/activity/recent',
  {
    default: () => []
  }
)

// Watch for data changes and update local refs
watch(statsData, newStats => {
  if (newStats) {
    stats.value = newStats
  }
})

watch(activityData, newActivity => {
  if (newActivity) {
    recentActivity.value = newActivity
  }
})

// Watch for errors
watch([statsError, activityError], ([statsErr, activityErr]) => {
  if (statsErr || activityErr) {
    error.value =
      statsErr?.message ||
      activityErr?.message ||
      'Failed to load dashboard data'
  }
})

// Update loading state based on pending state
const { pending } = await useFetch('/api/stats/dashboard', {
  default: () => ({ totalUsers: 0, totalBots: 0, totalPipelines: 0 })
})
watch(pending, isPending => {
  isLoading.value = isPending
})

const getActivityColor = (type: string): string => {
  const colors = {
    project: 'primary',
    user: 'success',
    bot: 'info',
    model: 'warning',
  }
  return colors[type as keyof typeof colors] || 'grey'
}

const getActivityIcon = (type: string): string => {
  const icons = {
    project: 'mdi-folder',
    user: 'mdi-account',
    bot: 'mdi-robot',
    model: 'mdi-brain',
  }
  return icons[type as keyof typeof icons] || 'mdi-circle'
}

const formatTimestamp = (timestamp: Date): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffInHours < 1) {
    return 'Just now'
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`
  } else {
    return date.toLocaleDateString()
  }
}

// Data is automatically fetched by useFetch
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.dashboard-header-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
}

.dashboard-header-card .v-card-title {
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.dashboard-header-card .v-card-subtitle {
  color: rgba(255, 255, 255, 0.9) !important;
}

.stat-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  transition: all 0.3s ease;
  height: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
}

.stat-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2) !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

.stat-card .v-card-text {
  color: white !important;
}

.stat-card .text-h3 {
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.stat-card .text-subtitle-1 {
  color: rgba(255, 255, 255, 0.9) !important;
}

.activity-card,
.quick-actions-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  height: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
}

.activity-card .v-card-title,
.quick-actions-card .v-card-title {
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.activity-card .v-card-text,
.quick-actions-card .v-card-text {
  color: rgba(255, 255, 255, 0.9) !important;
}

.activity-list {
  background: transparent !important;
}

.activity-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 0;
  color: white !important;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item .v-list-item-title {
  color: white !important;
}

.activity-item .v-list-item-subtitle {
  color: rgba(255, 255, 255, 0.7) !important;
}

.quick-actions-list {
  background: transparent !important;
}

.quick-action-item {
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.05) !important;
}

.quick-action-item:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  transform: translateX(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
}

.quick-action-item .v-list-item-title {
  color: white !important;
}

.quick-action-item .v-list-item-subtitle {
  color: rgba(255, 255, 255, 0.7) !important;
}

/* Enhanced glassmorphism effects for icons */
.stat-card .v-icon,
.activity-card .v-icon,
.quick-actions-card .v-icon {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }

  .dashboard-header-card .v-card-title {
    font-size: 1.5rem !important;
  }

  .stat-card .v-card-text {
    padding: 16px !important;
  }

  .stat-card .text-h3 {
    font-size: 2rem !important;
  }
}

@media (max-width: 480px) {
  .dashboard-container {
    padding: 12px;
  }

  .dashboard-header-card .v-card-title {
    font-size: 1.25rem !important;
  }

  .stat-card .text-h3 {
    font-size: 1.5rem !important;
  }
}
</style>
