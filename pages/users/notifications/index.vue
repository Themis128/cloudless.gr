<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-bell</v-icon>
            Notifications
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-6">
            <!-- Notification History -->
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-4">Loading notifications...</p>
            </div>

            <div v-else-if="notifications.length === 0" class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-bell-off</v-icon>
              <h3 class="text-h6 mt-4 mb-2">No notifications</h3>
              <p class="text-grey-darken-1">You're all caught up!</p>
            </div>

            <div v-else>
              <v-list class="pa-0">
                <v-list-item
                  v-for="notification in notifications"
                  :key="notification.id"
                  class="px-0"
                >
                  <template #prepend>
                    <v-avatar :color="getNotificationColor(notification.type)" size="40">
                      <v-icon :icon="getNotificationIcon(notification.type)" color="white" />
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ notification.title }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="mt-1">
                    {{ notification.message }}
                  </v-list-item-subtitle>
                  <v-list-item-subtitle class="text-caption text-grey-darken-1 mt-2">
                    {{ formatDate(notification.created_at) }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      v-if="!notification.read"
                      icon
                      size="small"
                      variant="text"
                      @click="markAsRead(notification.id)"
                    >
                      <v-icon>mdi-check</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
                <v-divider v-if="notification !== notifications[notifications.length - 1]" />
              </v-list>

              <!-- Load More -->
              <div v-if="hasMore" class="text-center mt-4">
                <v-btn variant="outlined" :loading="loadingMore" @click="loadMoreNotifications">
                  Load More
                </v-btn>
              </div>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-6">
            <v-btn
              v-if="unreadCount > 0"
              variant="outlined"
              :loading="markingAll"
              @click="markAllAsRead"
            >
              <v-icon start>mdi-check-all</v-icon>
              Mark All as Read ({{ unreadCount }})
            </v-btn>
            <v-spacer />
            <v-btn variant="outlined" @click="$router.push('/users/notifications/settings')">
              <v-icon start>mdi-cog</v-icon>
              Settings
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
const markingAll = ref(false)
const notifications = ref([])
const hasMore = ref(false)
const page = ref(1)
const pageSize = 20

// Computed
const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

// Methods
const loadNotifications = async (pageNum = 1) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

    if (error) throw error

    if (pageNum === 1) {
      notifications.value = data || []
    } else {
      notifications.value.push(...(data || []))
    }

    hasMore.value = data && data.length === pageSize
  } catch (error) {
    console.error('Error loading notifications:', error)
    // In a real app, you might want to show an error message
  }
}

const loadMoreNotifications = async () => {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  page.value += 1
  await loadNotifications(page.value)
  loadingMore.value = false
}

const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) throw error

    // Update local state
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      notification.read_at = new Date().toISOString()
    }
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

const markAllAsRead = async () => {
  if (markingAll.value || unreadCount.value === 0) return

  markingAll.value = true

  try {
    const unreadIds = notifications.value
      .filter(n => !n.read)
      .map(n => n.id)

    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds)

    if (error) throw error

    // Update local state
    notifications.value.forEach(notification => {
      if (!notification.read) {
        notification.read = true
        notification.read_at = new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
  } finally {
    markingAll.value = false
  }
}

const getNotificationColor = (type) => {
  const colors = {
    info: 'blue',
    success: 'success',
    warning: 'warning',
    error: 'error',
    project: 'purple',
    system: 'grey'
  }
  return colors[type] || 'blue'
}

const getNotificationIcon = (type) => {
  const icons = {
    info: 'mdi-information',
    success: 'mdi-check-circle',
    warning: 'mdi-alert-circle',
    error: 'mdi-alert-circle-outline',
    project: 'mdi-folder',
    system: 'mdi-cog'
  }
  return icons[type] || 'mdi-bell'
}

const formatDate = (dateString) => {
  if (!dateString) return ''

  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now'
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }

  // More than 1 week
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(async () => {
  await loadNotifications()
  loading.value = false
})

// Page meta
definePageMeta({
  layout: 'user',
  title: 'Notifications'
})

// SEO
useSeoMeta({
  title: 'Notifications - Cloudless.gr',
  description: 'View your notifications and updates'
})
</script>
