<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          System Administration
        </h1>
        <p class="text-slate-300">
          Manage users, monitor system health, and maintain the platform
        </p>
      </div>

      <div
        v-if="adminStore.loading"
        class="flex justify-center items-center py-12"
      >
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
        <span class="ml-4 text-white">Loading system data...</span>
      </div>

      <div
        v-else-if="adminStore.error"
        class="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6"
      >
        <div class="flex items-center">
          <span class="text-red-200">{{ adminStore.error }}</span>
        </div>
      </div>      <div
        v-else-if="authStore.isAdmin"
        class="space-y-8"
      >
        <!-- Success Admin Login Message -->
        <div
          v-if="authStore.successMessage"
          class="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <v-icon color="green" class="mr-3">mdi-check-circle</v-icon>
              <div>
                <p class="text-green-200 font-medium">Welcome, Administrator!</p>
                <p class="text-green-300 text-sm">{{ authStore.successMessage }}</p>
              </div>
            </div>
            <button
              aria-label="Dismiss message"
              class="text-green-300 hover:text-green-100 ml-4"
              @click="authStore.clearMessages()"
            >
              <v-icon>mdi-close</v-icon>
            </button>
          </div>
        </div>

        <div
          v-if="adminStore.stats"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-slate-300 text-sm">
                  Total Users
                </p>
                <p class="text-3xl font-bold text-white">
                  {{ adminStore.stats.totalUsers }}
                </p>
              </div>
              <div class="bg-blue-500/20 p-3 rounded-lg">
                <span class="text-blue-400">👥</span>
              </div>
            </div>
          </div>

          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-slate-300 text-sm">
                  Active Users
                </p>
                <p class="text-3xl font-bold text-white">
                  {{ adminStore.stats.activeUsers }}
                </p>
              </div>
              <div class="bg-green-500/20 p-3 rounded-lg">
                <span class="text-green-400">✓</span>
              </div>
            </div>
          </div>

          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-slate-300 text-sm">
                  Admin Users
                </p>
                <p class="text-3xl font-bold text-white">
                  {{ adminStore.stats.adminUsers }}
                </p>
              </div>
              <div class="bg-purple-500/20 p-3 rounded-lg">
                <span class="text-purple-400">🛡️</span>
              </div>
            </div>
          </div>

          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-slate-300 text-sm">
                  Recent Signups
                </p>
                <p class="text-3xl font-bold text-white">
                  {{ adminStore.stats.recentSignups }}
                </p>
              </div>
              <div class="bg-yellow-500/20 p-3 rounded-lg">
                <span class="text-yellow-400">📈</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="adminStore.systemHealth"
          class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <h3 class="text-xl font-bold text-white mb-4">
            System Health
          </h3>
          <div class="flex items-center mb-4">
            <div class="flex items-center">
              <div
                :class="{
                  'bg-green-500': adminStore.systemHealth.status === 'healthy',
                  'bg-yellow-500': adminStore.systemHealth.status === 'warning',
                  'bg-red-500': adminStore.systemHealth.status === 'critical'
                }"
                class="w-3 h-3 rounded-full mr-3"
              />
              <span class="text-white capitalize">{{ adminStore.systemHealth.status }}</span>
            </div>
            <div class="ml-auto text-slate-300 text-sm">
              Uptime: {{ adminStore.systemHealth.uptime }}
            </div>
          </div>
          <div
            v-if="adminStore.systemHealth.issues.length > 0"
            class="space-y-2"
          >
            <p class="text-slate-300 text-sm font-medium">
              Issues:
            </p>
            <div
              v-for="issue in adminStore.systemHealth.issues"
              :key="issue"
              class="text-red-300 text-sm"
            >
              • {{ issue }}
            </div>
          </div>
          <div
            v-else
            class="text-green-300 text-sm"
          >
            ✓ All systems operational
          </div>
        </div>

        <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-white">
              User Management
            </h3>
            <button
              class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white transition-colors"
              :disabled="adminStore.loading"
              @click="refreshData"
            >
              🔄 Refresh
            </button>
          </div>

          <div class="mb-4">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search users by email, name, or role..."
              class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            >
          </div>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="bg-white/5 rounded-lg p-4 border border-white/10"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center space-x-3">
                    <div>
                      <p class="text-white font-medium">
                        {{ user.full_name || user.email }}
                      </p>
                      <p class="text-slate-300 text-sm">
                        {{ user.email }}
                      </p>
                    </div>
                    <div class="flex space-x-2">
                      <span
                        :class="{
                          'bg-green-500/20 text-green-300': user.role === 'user',
                          'bg-purple-500/20 text-purple-300': user.role === 'admin',
                          'bg-blue-500/20 text-blue-300': user.role === 'moderator'
                        }"
                        class="px-2 py-1 rounded text-xs font-medium"
                      >
                        {{ user.role }}
                      </span>
                      <span
                        :class="{
                          'bg-green-500/20 text-green-300': user.is_active,
                          'bg-red-500/20 text-red-300': !user.is_active
                        }"
                        class="px-2 py-1 rounded text-xs font-medium"
                      >
                        {{ user.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    class="bg-yellow-600/20 hover:bg-yellow-600/30 disabled:opacity-50 text-yellow-300 px-3 py-1 rounded text-sm transition-colors"
                    :disabled="user.id === authStore.user?.id"
                    @click="toggleUserStatus(user)"
                  >
                    {{ user.is_active ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button
                    class="bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-300 px-3 py-1 rounded text-sm transition-colors"
                    :disabled="user.id === authStore.user?.id"
                    @click="deleteUser(user)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-12"
      >
        <div class="text-6xl mb-4">
          ⚠️
        </div>
        <h2 class="text-2xl font-bold text-white mb-2">
          Access Denied
        </h2>
        <p class="text-slate-300 mb-6">
          Administrator privileges required to access this page.
        </p>
        <NuxtLink
          to="/"
          class="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white transition-colors inline-block"
        >
          Return to Dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

definePageMeta({
  middleware: 'admin',
  layout: 'admin'
})

const authStore = useAuthStore()
const adminStore = useAdminStore()

const searchQuery = ref('')

const filteredUsers = computed(() => {
  if (!searchQuery.value) return adminStore.users
  return adminStore.searchUsers(searchQuery.value)
})

const refreshData = async () => {
  await adminStore.loadUsers()
  await adminStore.updateStats()
  await adminStore.checkSystemHealth()
}

const toggleUserStatus = async (user) => {
  const result = await adminStore.updateUserStatus(user.id, {
    is_active: !user.is_active
  })

  if (!result.success) {
    console.error('Failed to update user status:', result.error)
  }
}

const deleteUser = async (user) => {
  if (confirm(`Are you sure you want to delete user "${user.email}"? This action cannot be undone.`)) {
    const result = await adminStore.deleteUser(user.id)

    if (!result.success) {
      console.error('Failed to delete user:', result.error)
    }
  }
}

onMounted(async () => {
  if (authStore.user?.role === 'admin') {
    await adminStore.initialize()
    
    // Auto-clear success message after 5 seconds
    if (authStore.successMessage) {
      setTimeout(() => {
        authStore.clearMessages()
      }, 5000)
    }
  }
})
</script>
