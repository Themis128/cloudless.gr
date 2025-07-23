import { defineStore } from 'pinia'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  timestamp: Date
}

interface NotificationsState {
  notifications: Notification[]
  maxNotifications: number
}

export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    notifications: [],
    maxNotifications: 5
  }),

  getters: {
    currentNotifications: (state) => state.notifications,
    hasNotifications: (state) => state.notifications.length > 0
  },

  actions: {
    addNotification(notification: Omit<Notification, 'id' | 'timestamp'>) {
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        timestamp: new Date()
      }

      this.notifications.unshift(newNotification)

      // Keep only the latest notifications
      if (this.notifications.length > this.maxNotifications) {
        this.notifications = this.notifications.slice(0, this.maxNotifications)
      }

      // Auto-remove after duration
      if (notification.duration !== undefined) {
        setTimeout(() => {
          this.removeNotification(newNotification.id)
        }, notification.duration)
      }
    },

    removeNotification(id: string) {
      const index = this.notifications.findIndex(n => n.id === id)
      if (index > -1) {
        this.notifications.splice(index, 1)
      }
    },

    clearAll() {
      this.notifications = []
    },

    // Convenience methods
    success(title: string, message: string, duration = 5000) {
      this.addNotification({ type: 'success', title, message, duration })
    },

    error(title: string, message: string, duration = 10000) {
      this.addNotification({ type: 'error', title, message, duration })
    },

    warning(title: string, message: string, duration = 7000) {
      this.addNotification({ type: 'warning', title, message, duration })
    },

    info(title: string, message: string, duration = 5000) {
      this.addNotification({ type: 'info', title, message, duration })
    }
  }
}) 