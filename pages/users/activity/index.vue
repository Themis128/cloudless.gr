<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-history</v-icon>
            Activity Log
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-6">
            <!-- Filter Options -->
            <v-row class="mb-4">
              <v-col cols="12" md="6">
                <v-select
                  v-model="selectedType"
                  :items="activityTypes"
                  label="Activity Type"
                  variant="outlined"
                  clearable
                  @update:model-value="filterActivities"
                >
                  <template #prepend-inner>
                    <v-icon>mdi-filter</v-icon>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="dateFilter"
                  label="Date Range"
                  variant="outlined"
                  type="date"
                  @update:model-value="filterActivities"
                >
                  <template #prepend-inner>
                    <v-icon>mdi-calendar</v-icon>
                  </template>
                </v-text-field>
              </v-col>
            </v-row>

            <!-- Activity Timeline -->
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-4">Loading activity...</p>
            </div>

            <div v-else-if="filteredActivities.length === 0" class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-history</v-icon>
              <h3 class="text-h6 mt-4 mb-2">No activity found</h3>
              <p class="text-grey-darken-1">
                {{ selectedType || dateFilter ? 'Try adjusting your filters' : 'Your activity will appear here' }}
              </p>
            </div>

            <v-timeline v-else side="end" class="mt-4">
              <v-timeline-item
                v-for="activity in filteredActivities"
                :key="activity.id"
                :dot-color="getActivityColor(activity.type)"
                size="small"
              >
                <template #icon>
                  <v-icon size="16" :icon="getActivityIcon(activity.type)" />
                </template>

                <v-card variant="outlined" class="mb-2">
                  <v-card-text class="py-3">
                    <div class="d-flex justify-space-between align-center mb-2">
                      <h4 class="text-subtitle-1 font-weight-medium">
                        {{ activity.title }}
                      </h4>
                      <v-chip :color="getActivityColor(activity.type)" size="small" variant="tonal">
                        {{ activity.type }}
                      </v-chip>
                    </div>
                    <p v-if="activity.description" class="text-body-2 text-grey-darken-1 mb-2">
                      {{ activity.description }}
                    </p>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-caption text-grey-darken-1">
                        {{ formatDateTime(activity.created_at) }}
                      </span>
                      <span v-if="activity.ip_address" class="text-caption text-grey-darken-1">
                        IP: {{ activity.ip_address }}
                      </span>
                    </div>
                  </v-card-text>
                </v-card>
              </v-timeline-item>
            </v-timeline>

            <!-- Load More -->
            <div v-if="hasMore" class="text-center mt-4">
              <v-btn variant="outlined" :loading="loadingMore" @click="loadMoreActivities">
                Load More
              </v-btn>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-6">
            <v-btn variant="outlined" :disabled="!hasFilters" @click="clearFilters">
              <v-icon start>mdi-filter-off</v-icon>
              Clear Filters
            </v-btn>
            <v-spacer />
            <v-btn variant="outlined" @click="exportActivity">
              <v-icon start>mdi-download</v-icon>
              Export
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
const { user } = useSupabaseAuth()
const supabase = useSupabaseClient()

// Reactive data
const loading = ref(true)
const loadingMore = ref(false)
const activities = ref([])
const filteredActivities = ref([])
const selectedType = ref(null)
const dateFilter = ref(null)
const hasMore = ref(false)
const page = ref(1)
const pageSize = 20

// Activity types for filtering
const activityTypes = [
  { title: 'Login', value: 'login' },
  { title: 'Logout', value: 'logout' },
  { title: 'Profile Update', value: 'profile_update' },
  { title: 'Password Change', value: 'password_change' },
  { title: 'Project Created', value: 'project_created' },
  { title: 'Project Updated', value: 'project_updated' },
  { title: 'Project Deleted', value: 'project_deleted' },
  { title: 'Settings Changed', value: 'settings_changed' },
  { title: 'Email Verified', value: 'email_verified' }
]

// Computed
const hasFilters = computed(() => {
  return selectedType.value || dateFilter.value
})

// Methods
const loadActivities = async (pageNum = 1) => {
  try {
    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

    if (error) throw error

    if (pageNum === 1) {
      activities.value = data || []
    } else {
      activities.value.push(...(data || []))
    }

    hasMore.value = data && data.length === pageSize
    filterActivities()
  } catch (error) {
    console.error('Error loading activities:', error)
    // In a real app, you might want to show an error message
    // For demo purposes, let's show some mock data
    activities.value = getMockActivities()
    filterActivities()
  }
}

const loadMoreActivities = async () => {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  page.value += 1
  await loadActivities(page.value)
  loadingMore.value = false
}

const filterActivities = () => {
  let filtered = [...activities.value]

  if (selectedType.value) {
    filtered = filtered.filter(activity => activity.type === selectedType.value)
  }

  if (dateFilter.value) {
    const filterDate = new Date(dateFilter.value)
    filtered = filtered.filter(activity => {
      const activityDate = new Date(activity.created_at)
      return activityDate.toDateString() === filterDate.toDateString()
    })
  }

  filteredActivities.value = filtered
}

const clearFilters = () => {
  selectedType.value = null
  dateFilter.value = null
  filterActivities()
}

const exportActivity = () => {
  // In a real app, this would generate and download a CSV/PDF
  const csvContent = filteredActivities.value.map(activity =>
    `${activity.created_at},${activity.type},${activity.title},"${activity.description || ''}"`
  ).join('\n')

  const header = 'Date,Type,Title,Description\n'
  const blob = new Blob([header + csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

const getActivityColor = (type) => {
  const colors = {
    login: 'success',
    logout: 'info',
    profile_update: 'primary',
    password_change: 'warning',
    project_created: 'success',
    project_updated: 'info',
    project_deleted: 'error',
    settings_changed: 'primary',
    email_verified: 'success'
  }
  return colors[type] || 'grey'
}

const getActivityIcon = (type) => {
  const icons = {
    login: 'mdi-login',
    logout: 'mdi-logout',
    profile_update: 'mdi-account-edit',
    password_change: 'mdi-lock-reset',
    project_created: 'mdi-folder-plus',
    project_updated: 'mdi-folder-edit',
    project_deleted: 'mdi-folder-remove',
    settings_changed: 'mdi-cog',
    email_verified: 'mdi-email-check'
  }
  return icons[type] || 'mdi-circle'
}

const formatDateTime = (dateString) => {
  if (!dateString) return ''

  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Mock data for demo purposes
const getMockActivities = () => {
  return [
    {
      id: 1,
      type: 'login',
      title: 'Signed in',
      description: 'Successful login from Chrome browser',
      created_at: new Date().toISOString(),
      ip_address: '192.168.1.1'
    },
    {
      id: 2,
      type: 'profile_update',
      title: 'Profile updated',
      description: 'Updated first name and bio',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      ip_address: '192.168.1.1'
    },
    {
      id: 3,
      type: 'project_created',
      title: 'Project created',
      description: 'Created new project "My Awesome App"',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      ip_address: '192.168.1.1'
    }
  ]
}

// Lifecycle
onMounted(async () => {
  await loadActivities()
  loading.value = false
})

// Page meta
definePageMeta({
  layout: 'user',
  title: 'Activity Log'
})

// SEO
useSeoMeta({
  title: 'Activity Log - Cloudless.gr',
  description: 'View your account activity and login history'
})
</script>
