<template>
<<<<<<< HEAD
  <div class="admin-dashboard">
    <v-container>
      <!-- Header -->
      <v-row>
        <v-col cols="12">
          <v-card class="mb-6">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-3" size="large" color="primary">mdi-shield-crown</v-icon>
              <div>
                <h1 class="text-h4 font-weight-bold">Admin Dashboard</h1>
                <p class="text-subtitle-1 text-medium-emphasis mb-0">
                  System administration and monitoring
                </p>
              </div>
            </v-card-title>
          </v-card>
        </v-col>
      </v-row>

      <!-- Quick Stats -->
      <v-row>
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4">
            <v-icon size="48" color="success" class="mb-3">mdi-database-check</v-icon>
            <h3 class="text-h5 font-weight-bold">{{ stats.databaseStatus }}</h3>
            <p class="text-body-2 text-medium-emphasis">Database</p>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4">
            <v-icon size="48" color="info" class="mb-3">mdi-memory</v-icon>
            <h3 class="text-h5 font-weight-bold">{{ stats.redisStatus }}</h3>
            <p class="text-body-2 text-medium-emphasis">Redis Cache</p>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4">
            <v-icon size="48" color="warning" class="mb-3">mdi-account-group</v-icon>
            <h3 class="text-h5 font-weight-bold">{{ stats.userCount }}</h3>
            <p class="text-body-2 text-medium-emphasis">Active Users</p>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4">
            <v-icon size="48" color="primary" class="mb-3">mdi-robot</v-icon>
            <h3 class="text-h5 font-weight-bold">{{ stats.botCount }}</h3>
            <p class="text-body-2 text-medium-emphasis">Active Bots</p>
          </v-card>
        </v-col>
      </v-row>

      <!-- Admin Sections -->
      <v-row class="mt-6">
        <v-col cols="12">
          <h2 class="text-h5 font-weight-bold mb-4">Administration Tools</h2>
        </v-col>
      </v-row>

      <v-row>
        <!-- System Health -->
        <v-col cols="12" md="6" lg="4">
                     <v-card class="h-100" elevation="2" @click="handleNavigation('/admin/health')">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="success">mdi-heart-pulse</v-icon>
              System Health
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis">
                Monitor system performance, database connections, and service status
              </p>
              <v-chip color="success" size="small" class="mt-2">
                <v-icon start size="small">mdi-check-circle</v-icon>
                All Systems Operational
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" color="primary">
                View Details
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Redis Analytics -->
        <v-col cols="12" md="6" lg="4">
                     <v-card class="h-100" elevation="2" @click="handleNavigation('/admin/redis-analytics')">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="info">mdi-chart-line</v-icon>
              Redis Analytics
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis">
                Monitor Redis performance, memory usage, and cache statistics
              </p>
              <v-chip color="info" size="small" class="mt-2">
                <v-icon start size="small">mdi-memory</v-icon>
                {{ redisStats.memoryUsage || '0B' }} Used
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" color="primary">
                View Analytics
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- User Management -->
        <v-col cols="12" md="6" lg="4">
                     <v-card class="h-100" elevation="2" @click="handleNavigation('/admin/users')">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="warning">mdi-account-cog</v-icon>
              User Management
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis">
                Manage user accounts, roles, and permissions
              </p>
              <v-chip color="warning" size="small" class="mt-2">
                <v-icon start size="small">mdi-account-group</v-icon>
                {{ stats.userCount }} Users
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" color="primary">
                Manage Users
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Project Management -->
        <v-col cols="12" md="6" lg="4">
                     <v-card class="h-100" elevation="2" @click="handleNavigation('/admin/projects')">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-folder-multiple</v-icon>
              Project Management
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis">
                Overview of all projects and their status
              </p>
              <v-chip color="primary" size="small" class="mt-2">
                <v-icon start size="small">mdi-folder</v-icon>
                {{ stats.projectCount || 0 }} Projects
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" color="primary">
                View Projects
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Role Management -->
        <v-col cols="12" md="6" lg="4">
                     <v-card class="h-100" elevation="2" @click="handleNavigation('/admin/roles')">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="purple">mdi-shield-account</v-icon>
              Role Management
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis">
                Configure user roles and access permissions
              </p>
              <v-chip color="purple" size="small" class="mt-2">
                <v-icon start size="small">mdi-shield</v-icon>
                {{ stats.roleCount || 3 }} Roles
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" color="primary">
                Manage Roles
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- System Logs -->
        <v-col cols="12" md="6" lg="4">
                     <v-card class="h-100" elevation="2" @click="handleNavigation('/debug/logs')">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="error">mdi-file-document</v-icon>
              System Logs
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis">
                View system logs and error reports
              </p>
              <v-chip color="error" size="small" class="mt-2">
                <v-icon start size="small">mdi-alert</v-icon>
                {{ stats.errorCount || 0 }} Errors
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" color="primary">
                View Logs
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recent Activity -->
      <v-row class="mt-6">
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-clock-outline</v-icon>
              Recent Activity
            </v-card-title>
            <v-card-text>
              <v-list v-if="recentActivity.length > 0">
                <v-list-item v-for="activity in recentActivity" :key="activity.id">
                  <template v-slot:prepend>
                    <v-icon :color="getActivityColor(activity.type)">
                      {{ getActivityIcon(activity.type) }}
                    </v-icon>
                  </template>
                  <v-list-item-title>{{ activity.description }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatTime(activity.timestamp) }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
              <div v-else class="text-center py-4">
                <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-clock-outline</v-icon>
                <p class="text-body-2 text-medium-emphasis">No recent activity</p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
=======
  <div>
    <p>Redirecting to admin dashboard...</p>
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  </div>
</template>

<script setup lang="ts">
<<<<<<< HEAD
import { ref, onMounted } from 'vue'

// Define the layout
definePageMeta({
  layout: 'default',
  middleware: 'admin'
})

// Reactive data
const stats = ref({
  databaseStatus: 'Connected',
  redisStatus: 'Connected',
  userCount: 0,
  botCount: 0,
  projectCount: 0,
  roleCount: 3,
  errorCount: 0
})

const redisStats = ref({
  memoryUsage: '0B'
})

const recentActivity = ref([
  {
    id: 1,
    type: 'login',
    description: 'Admin user logged in',
    timestamp: new Date()
  },
  {
    id: 2,
    type: 'system',
    description: 'System health check completed',
    timestamp: new Date(Date.now() - 300000)
  },
  {
    id: 3,
    type: 'user',
    description: 'New user registration',
    timestamp: new Date(Date.now() - 600000)
  }
])

// Methods
const handleNavigation = (path: string) => {
  navigateTo(path)
}

const getActivityColor = (type: string) => {
  const colors = {
    login: 'success',
    system: 'info',
    user: 'warning',
    error: 'error'
  }
  return colors[type] || 'grey'
}

const getActivityIcon = (type: string) => {
  const icons = {
    login: 'mdi-login',
    system: 'mdi-cog',
    user: 'mdi-account',
    error: 'mdi-alert'
  }
  return icons[type] || 'mdi-information'
}

const formatTime = (timestamp: Date) => {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((timestamp.getTime() - Date.now()) / (1000 * 60)),
    'minute'
  )
}

const fetchStats = async () => {
  try {
    // Fetch system stats with individual error handling
    try {
      const systemResponse = await $fetch('/api/health/system')
    } catch (error) {
      console.warn('Could not fetch system health:', error)
    }
    
    try {
      const dbResponse = await $fetch('/api/health/database')
      stats.value.databaseStatus = dbResponse.status === 'healthy' ? 'Connected' : 'Error'
    } catch (error) {
      console.warn('Could not fetch database health:', error)
      stats.value.databaseStatus = 'Error'
    }
    
    try {
      const redisResponse = await $fetch('/api/health/redis')
      stats.value.redisStatus = redisResponse.status === 'healthy' ? 'Connected' : 'Error'
    } catch (error) {
      console.warn('Could not fetch Redis health:', error)
      stats.value.redisStatus = 'Error'
    }
    
    // Fetch user and project counts
    try {
      const usersResponse = await $fetch('/api/admin/users')
      stats.value.userCount = usersResponse.total || 0
    } catch (error) {
      console.warn('Could not fetch user count:', error)
      stats.value.userCount = 0
    }
    
    try {
      const projectsResponse = await $fetch('/api/admin/projects')
      stats.value.projectCount = projectsResponse.total || 0
    } catch (error) {
      console.warn('Could not fetch project count:', error)
      stats.value.projectCount = 0
    }
    
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    // Set default values on error
    stats.value.databaseStatus = 'Error'
    stats.value.redisStatus = 'Error'
  }
}

const fetchRedisStats = async () => {
  try {
    const response = await $fetch('/api/admin/redis-analytics')
    redisStats.value.memoryUsage = response.memory.usedMemoryHuman
  } catch (error) {
    console.warn('Could not fetch Redis stats:', error)
    redisStats.value.memoryUsage = '0B'
  }
}

// Lifecycle
onMounted(() => {
  fetchStats()
  fetchRedisStats()
  
  // Refresh stats every 30 seconds
  setInterval(() => {
    fetchStats()
    fetchRedisStats()
  }, 30000)
})
</script>

<style scoped>
.admin-dashboard {
  padding: 20px 0;
}

.h-100 {
  height: 100%;
}

.v-card {
  cursor: pointer;
  transition: transform 0.2s ease-in-out;
}

.v-card:hover {
  transform: translateY(-2px);
}

/* Ensure all text in admin dashboard is black */
.admin-dashboard :deep(.v-card-title),
.admin-dashboard :deep(.v-card-text),
.admin-dashboard :deep(.v-card-subtitle),
.admin-dashboard :deep(.v-list-item-title),
.admin-dashboard :deep(.v-list-item-subtitle),
.admin-dashboard :deep(.text-h4),
.admin-dashboard :deep(.text-h5),
.admin-dashboard :deep(.text-body-2),
.admin-dashboard :deep(.text-subtitle-1),
.admin-dashboard :deep(.text-medium-emphasis),
.admin-dashboard :deep(p),
.admin-dashboard :deep(h1),
.admin-dashboard :deep(h2),
.admin-dashboard :deep(h3) {
  color: #000000 !important;
}
</style> 
=======
import { navigateTo } from '#app'
import { onMounted } from 'vue';

// Redirect to the admin dashboard
onMounted(async (): Promise<void> => {
  await navigateTo('/admin/dashboard');
});
</script>
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
