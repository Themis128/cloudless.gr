<template>  <div class="dashboard-container">
    <!-- Loading State -->
    <div v-if="loading" class="d-flex align-center justify-center fill-height">
      <v-card class="pa-8 text-center" elevation="3" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);">
        <v-progress-circular
          indeterminate
          size="64"
          color="primary"
          class="mb-4"
        />
        <h2 class="text-h5 mb-2">Loading Dashboard...</h2>
        <p class="text-body-1 text-medium-emphasis">
          Please wait while we load your data.
        </p>
      </v-card>
    </div>    <!-- Error State -->
    <div v-else-if="error" class="d-flex align-center justify-center fill-height">
      <UiErrorCard
        title="Unable to Load Dashboard"
        :message="error"
        :details="error.includes('timeout') ? 'This might be a network connectivity issue. Please check your internet connection and try again.' : 'If this problem persists, please contact support.'"
        icon="mdi-view-dashboard-alert"
        color="error"
        :retry-action="true"
        retry-text="Retry Loading"
        :fallback-action="true"
        fallback-text="Sign In Again"
        :loading="loading"
        @retry="retryLoadData"
        @fallback="() => $router.push('/auth/login')"
      />
    </div>

    <!-- Main Dashboard Content -->
    <v-container v-else class="py-8" style="position: relative; z-index: 1;">
      <v-row>
        <v-col cols="12">
          <!-- Welcome Header -->
          <v-card class="mb-6" variant="elevated" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);">
            <v-card-title class="text-h4 pa-6 d-flex align-center">
              <v-icon icon="mdi-view-dashboard" class="me-3" color="primary"></v-icon>
              Welcome back, {{ userDisplayName }}!
            </v-card-title>
            <v-card-text class="pb-6">
              <p class="text-body-1 mb-0">Here's your personalized dashboard with quick access to your projects and activities.</p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <!-- Quick Stats -->
        <v-col cols="12" md="4">
          <v-card variant="elevated" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
            <v-card-text class="text-center pa-6">
              <v-icon icon="mdi-folder-multiple" size="48" color="primary" class="mb-3"></v-icon>
              <div class="text-h4 font-weight-bold text-primary">{{ stats.projects }}</div>
              <div class="text-body-2 text-medium-emphasis">Your Projects</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card variant="elevated" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
            <v-card-text class="text-center pa-6">
              <v-icon icon="mdi-clock-outline" size="48" color="success" class="mb-3"></v-icon>
              <div class="text-h4 font-weight-bold text-success">{{ stats.recentActivity }}</div>
              <div class="text-body-2 text-medium-emphasis">Recent Activities</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card variant="elevated" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
            <v-card-text class="text-center pa-6">
              <v-icon icon="mdi-chart-line" size="48" color="info" class="mb-3"></v-icon>
              <div class="text-h4 font-weight-bold text-info">{{ stats.completedTasks }}</div>
              <div class="text-body-2 text-medium-emphasis">Completed Tasks</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-6">
        <!-- Quick Actions -->
        <v-col cols="12" lg="8">
          <v-card variant="elevated" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
            <v-card-title class="d-flex align-center pa-6">
              <v-icon icon="mdi-lightning-bolt" class="me-3" color="warning"></v-icon>
              Quick Actions
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6" md="4">
                  <v-btn
                    to="/projects/new"
                    color="primary"
                    variant="elevated"
                    size="large"
                    block
                    class="mb-3"
                  >
                    <v-icon start icon="mdi-plus"></v-icon>
                    New Project
                  </v-btn>
                </v-col>
                
                <v-col cols="12" sm="6" md="4">
                  <v-btn
                    to="/projects"
                    color="secondary"
                    variant="elevated"
                    size="large"
                    block
                    class="mb-3"
                  >
                    <v-icon start icon="mdi-folder-open"></v-icon>
                    View Projects
                  </v-btn>
                </v-col>
                
                <v-col cols="12" sm="6" md="4">
                  <v-btn
                    to="/settings"
                    color="info"
                    variant="elevated"
                    size="large"
                    block
                    class="mb-3"
                  >
                    <v-icon start icon="mdi-account-edit"></v-icon>
                    Settings
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Recent Activity -->
        <v-col cols="12" lg="4">
          <v-card variant="elevated" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
            <v-card-title class="d-flex align-center pa-6">
              <v-icon icon="mdi-history" class="me-3" color="success"></v-icon>
              Recent Activity
            </v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item
                  v-for="activity in recentActivities"
                  :key="activity.id"
                  :prepend-icon="activity.icon"
                  :title="activity.title"
                  :subtitle="activity.time"
                  class="mb-2"
                >
                  <template #prepend>
                    <v-icon :color="activity.color" :icon="activity.icon"></v-icon>
                  </template>
                </v-list-item>
                
                <v-list-item v-if="recentActivities.length === 0">
                  <v-list-item-title class="text-center text-medium-emphasis">
                    No recent activity
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-6">
        <!-- User Profile Card -->
        <v-col cols="12">
          <v-card variant="elevated" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px);">
            <v-card-title class="d-flex align-center pa-6">
              <v-icon icon="mdi-account-circle" class="me-3" color="primary"></v-icon>
              Profile Information
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">                  <v-list density="compact">
                    <v-list-item>
                      <template #prepend>
                        <v-icon icon="mdi-email" color="primary"></v-icon>
                      </template>
                      <v-list-item-title>Email</v-list-item-title>
                      <v-list-item-subtitle>{{ user?.email || 'Not available' }}</v-list-item-subtitle>
                    </v-list-item>
                    
                    <v-list-item>
                      <template #prepend>
                        <v-icon icon="mdi-account" color="success"></v-icon>
                      </template>
                      <v-list-item-title>Name</v-list-item-title>
                      <v-list-item-subtitle>{{ user?.user_metadata?.full_name || user?.user_metadata?.name || 'Not set' }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-list density="compact">
                    <v-list-item>
                      <template #prepend>
                        <v-icon icon="mdi-calendar" color="info"></v-icon>
                      </template>
                      <v-list-item-title>Member Since</v-list-item-title>
                      <v-list-item-subtitle>{{ formatDate(user?.created_at) }}</v-list-item-subtitle>
                    </v-list-item>
                    
                    <v-list-item>
                      <template #prepend>
                        <v-icon icon="mdi-clock-outline" color="warning"></v-icon>
                      </template>
                      <v-list-item-title>Last Sign In</v-list-item-title>
                      <v-list-item-subtitle>{{ formatDate(user?.last_sign_in_at) }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Nuxt 3 imports
import { ref, onMounted, computed } from '#imports'

// Define page meta first
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

// Supabase composables
const user = useSupabaseUser()
const supabase = useSupabaseClient()

// Loading and error states
const loading = ref(true)
const error = ref<string | null>(null)

// Dashboard data
const stats = ref({
  projects: 0,
  recentActivity: 0,
  completedTasks: 0
})

const recentActivities = ref([
  {
    id: 1,
    title: 'Created new project',
    time: '2 hours ago',
    icon: 'mdi-folder-plus',
    color: 'primary'
  },
  {
    id: 2,
    title: 'Updated profile',
    time: '1 day ago',
    icon: 'mdi-account-edit',
    color: 'success'
  },
  {
    id: 3,
    title: 'Completed task',
    time: '2 days ago',
    icon: 'mdi-check-circle',
    color: 'info'
  }
])

// Computed user display name
const userDisplayName = computed(() => {
  if (!user.value) return 'Guest'
  return user.value.user_metadata?.full_name || 
         user.value.user_metadata?.name || 
         user.value.email?.split('@')[0] || 
         'User'
})

// Utility functions
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'Not available'
  
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid date'
  }
}

// Load dashboard data with proper error handling
const loadDashboardData = async () => {
  try {
    loading.value = true
    error.value = null

    // Check user session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      throw new Error('Unable to verify authentication. Please sign in again.')
    }

    if (!session) {
      console.log('No active session found, redirecting to login')
      await navigateTo('/auth/login')
      return
    }

    // Simulate API calls with timeout and error handling
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout - please check your internet connection'))
      }, 10000) // 10 second timeout

      // Simulate loading data
      setTimeout(() => {
        clearTimeout(timeout)
        stats.value = {
          projects: Math.floor(Math.random() * 10) + 1,
          recentActivity: Math.floor(Math.random() * 20) + 5,
          completedTasks: Math.floor(Math.random() * 50) + 10
        }
        resolve(true)
      }, 1000)
    })

    console.log('Dashboard data loaded successfully')

  } catch (err: any) {
    console.error('Error loading dashboard data:', err)
    error.value = err.message || 'Failed to load dashboard data. Please refresh the page.'
  } finally {
    loading.value = false
  }
}

// Retry function
const retryLoadData = async () => {
  await loadDashboardData()
}

// Lifecycle
onMounted(async () => {
  // Wait a moment for auth to settle
  await nextTick()
  
  // Check if user is authenticated
  if (!user.value) {
    console.log('No user found, redirecting to login')
    await navigateTo('/auth/login')
    return
  }
  
  console.log('User authenticated, loading dashboard data for:', user.value.email)
  
  // Load dashboard data
  await loadDashboardData()
})
</script>

<style scoped>
.dashboard-container {
  position: relative;
  min-height: 100vh;
}

.v-card {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.v-btn {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.v-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
}

.v-list-item:hover {
  background: rgba(var(--v-theme-primary), 0.05);
}
</style>
