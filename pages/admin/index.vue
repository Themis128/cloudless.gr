<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900">
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          Admin Dashboard
        </h1>
        <p class="text-slate-300">
          Welcome back, {{ authStore.user?.full_name || authStore.user?.email }}
        </p>
        <v-chip color="purple" size="small" class="mt-2">
          Administrator Access
        </v-chip>
      </div>      <!-- Success Admin Login Message -->
      <div
        v-if="authStore.successMessage && authStore.isAdmin"
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

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <!-- Quick Stats -->
        <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-300 text-sm">System Status</p>
              <p class="text-2xl font-bold text-green-400">Operational</p>
            </div>
            <div class="bg-green-500/20 p-3 rounded-lg">
              <v-icon color="green" size="24">mdi-check-circle</v-icon>
            </div>
          </div>
        </div>

        <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-300 text-sm">Active Users</p>
              <p class="text-2xl font-bold text-white">{{ adminStore.activeUsers || '...' }}</p>
            </div>
            <div class="bg-blue-500/20 p-3 rounded-lg">
              <v-icon color="blue" size="24">mdi-account-group</v-icon>
            </div>
          </div>
        </div>

        <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-300 text-sm">Total Users</p>
              <p class="text-2xl font-bold text-white">{{ adminStore.totalUsers || '...' }}</p>
            </div>
            <div class="bg-purple-500/20 p-3 rounded-lg">
              <v-icon color="purple" size="24">mdi-account-multiple</v-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-8">
        <h3 class="text-xl font-bold text-white mb-4">Quick Actions</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <v-btn
            color="blue"
            variant="outlined"
            size="large"
            @click="navigateTo('/sys')"
          >
            <v-icon left>mdi-shield-crown</v-icon>
            System Admin
          </v-btn>
          
          <v-btn
            color="green"
            variant="outlined"
            size="large"
            @click="navigateTo('/admin/users')"
          >
            <v-icon left>mdi-account-multiple</v-icon>
            User Management
          </v-btn>
          
          <v-btn
            color="orange"
            variant="outlined"
            size="large"
            @click="navigateTo('/admin/monitor')"
          >
            <v-icon left>mdi-monitor-dashboard</v-icon>
            System Monitor
          </v-btn>
          
          <v-btn
            color="purple"
            variant="outlined"
            size="large"
            @click="navigateTo('/admin/settings')"
          >
            <v-icon left>mdi-cog-outline</v-icon>
            Settings
          </v-btn>
        </div>
      </div>

      <!-- Access All Areas -->
      <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 class="text-xl font-bold text-white mb-4">Universal Access</h3>
        <p class="text-slate-300 mb-4">
          As an administrator, you have access to all areas of the application:
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <v-btn
            color="teal"
            variant="text"
            @click="navigateTo('/projects')"
          >
            <v-icon left>mdi-brain</v-icon>
            Projects Area
          </v-btn>
          
          <v-btn
            color="teal"
            variant="text"
            @click="navigateTo('/users')"
          >
            <v-icon left>mdi-account</v-icon>
            User Area
          </v-btn>
          
          <v-btn
            color="teal"
            variant="text"
            @click="navigateTo('/storage')"
          >
            <v-icon left>mdi-folder</v-icon>
            Storage Area
          </v-btn>
          
          <v-btn
            color="teal"
            variant="text"
            @click="navigateTo('/settings')"
          >
            <v-icon left>mdi-cog</v-icon>
            Settings
          </v-btn>
          
          <v-btn
            color="teal"
            variant="text"
            @click="navigateTo('/info')"
          >
            <v-icon left>mdi-information</v-icon>
            Information
          </v-btn>
          
          <v-btn
            color="teal"
            variant="text"
            @click="navigateTo('/documentation')"
          >
            <v-icon left>mdi-book</v-icon>
            Documentation
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template><script setup>
import { onMounted } from 'vue'

definePageMeta({
  middleware: 'admin',
  layout: 'admin'
})

const authStore = useAuthStore()
const adminStore = useAdminStore()

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
