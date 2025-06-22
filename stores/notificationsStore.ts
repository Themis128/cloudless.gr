import { defineStore } from 'pinia'

export interface AppNotification {
  id: string
  user_id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  created_at: string
  updated_at: string
}

interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
}

export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
  }),

  getters: {
    unreadNotifications: (state) => state.notifications.filter(n => !n.read),
    readNotifications: (state) => state.notifications.filter(n => n.read),
    notificationsByType: (state) => (type: string) => 
      state.notifications.filter(n => n.type === type),
    recentNotifications: (state) => 
      state.notifications.slice(0, 5), // Get last 5 notifications
  },

  actions: {
    async fetchNotifications(): Promise<void> {
      this.loading = true
      this.error = null

      try {
        // For now, use mock data - in the future this would connect to Supabase
        this.notifications = this.getMockNotifications()
        this.updateUnreadCount()
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to fetch notifications'
        console.error('Error fetching notifications:', error)
      } finally {
        this.loading = false
      }
    },

    async markAsRead(notificationId: string): Promise<boolean> {
      try {
        // Update local state
        const notification = this.notifications.find(n => n.id === notificationId)
        if (notification) {
          notification.read = true
          notification.updated_at = new Date().toISOString()
          this.updateUnreadCount()
        }
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to mark notification as read'
        console.error('Error marking notification as read:', error)
        return false
      }
    },

    async markAsUnread(notificationId: string): Promise<boolean> {
      try {
        // Update local state
        const notification = this.notifications.find(n => n.id === notificationId)
        if (notification) {
          notification.read = false
          notification.updated_at = new Date().toISOString()
          this.updateUnreadCount()
        }
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to mark notification as unread'
        console.error('Error marking notification as unread:', error)
        return false
      }
    },

    async markAllAsRead(): Promise<boolean> {
      try {
        this.notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true
            notification.updated_at = new Date().toISOString()
          }
        })
        this.updateUnreadCount()
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to mark all notifications as read'
        console.error('Error marking all notifications as read:', error)
        return false
      }
    },

    async deleteNotification(notificationId: string): Promise<boolean> {
      try {
        const index = this.notifications.findIndex(n => n.id === notificationId)
        if (index !== -1) {
          this.notifications.splice(index, 1)
          this.updateUnreadCount()
        }
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to delete notification'
        console.error('Error deleting notification:', error)
        return false
      }
    },

    async createNotification(notification: Omit<AppNotification, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
      try {
        const newNotification: AppNotification = {
          ...notification,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        
        this.notifications.unshift(newNotification)
        this.updateUnreadCount()
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to create notification'
        console.error('Error creating notification:', error)
        return false
      }
    },

    updateUnreadCount() {
      this.unreadCount = this.notifications.filter(n => !n.read).length
    },

    clearError() {
      this.error = null
    },

    // Helper methods for filtering
    getNotificationsByType(type: string): AppNotification[] {
      return this.notifications.filter(n => n.type === type)
    },

    getNotificationsByDateRange(startDate: Date, endDate: Date): AppNotification[] {
      return this.notifications.filter(n => {
        const notificationDate = new Date(n.created_at)
        return notificationDate >= startDate && notificationDate <= endDate
      })
    },

    // Mock data for demonstration
    getMockNotifications(): AppNotification[] {
      const now = new Date()
      const hour = 60 * 60 * 1000
      const day = 24 * hour

      return [
        {
          id: '1',
          user_id: 'user1',
          type: 'success',
          title: 'Project Deployed Successfully',
          message: 'Your project "Cloud Analytics Platform" has been deployed successfully to production.',
          read: false,
          created_at: new Date(now.getTime() - 2 * hour).toISOString(),
          updated_at: new Date(now.getTime() - 2 * hour).toISOString(),
        },
        {
          id: '2',
          user_id: 'user1',
          type: 'info',
          title: 'New Feature Available',
          message: 'Check out our new analytics pipeline builder with enhanced data visualization.',
          read: false,
          created_at: new Date(now.getTime() - 6 * hour).toISOString(),
          updated_at: new Date(now.getTime() - 6 * hour).toISOString(),
        },
        {
          id: '3',
          user_id: 'user1',
          type: 'warning',
          title: 'Scheduled Maintenance',
          message: 'System maintenance is scheduled for tonight from 2:00 AM to 4:00 AM UTC.',
          read: true,
          created_at: new Date(now.getTime() - day).toISOString(),
          updated_at: new Date(now.getTime() - day + hour).toISOString(),
        },
        {
          id: '4',
          user_id: 'user1',
          type: 'error',
          title: 'Pipeline Execution Failed',
          message: 'Your analytics pipeline "User Behavior Analysis" failed during execution. Check the logs for details.',
          read: true,
          created_at: new Date(now.getTime() - 2 * day).toISOString(),
          updated_at: new Date(now.getTime() - 2 * day + 30 * 60 * 1000).toISOString(),
        },
        {
          id: '5',
          user_id: 'user1',
          type: 'info',
          title: 'Welcome to Cloudless!',
          message: 'Thank you for joining our platform. Explore our features and start building amazing projects.',
          read: true,
          created_at: new Date(now.getTime() - 7 * day).toISOString(),
          updated_at: new Date(now.getTime() - 7 * day).toISOString(),
        },
      ]
    },
  },
})
