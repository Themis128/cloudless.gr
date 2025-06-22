<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          Admin Documentation
        </h1>
        <p class="text-slate-300">
          Administration guides, API references, and system documentation
        </p>
        <v-chip color="purple" size="small" class="mt-2">
          Admin Access Only
        </v-chip>
      </div>      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Documentation Pages from Store -->
        <div 
          v-for="page in docStore.adminPages" 
          :key="page.id"
          class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-purple-400/50 transition-colors"
        >
          <div class="flex items-center mb-4">
            <div class="bg-blue-500/20 p-3 rounded-lg mr-4">
              <v-icon :color="getIconColor(page.category)">{{ page.icon }}</v-icon>
            </div>
            <div>
              <h3 class="text-xl font-bold text-white">{{ page.title }}</h3>
              <p class="text-slate-300 text-sm">{{ page.description }}</p>
            </div>
          </div>
          <div class="mb-4">
            <p class="text-slate-400 mb-3">
              {{ page.description }}
            </p>
            <div class="flex items-center gap-2 mb-3">
              <v-chip 
                :color="getDifficultyColor(page.difficulty)" 
                size="small" 
                variant="outlined"
              >
                {{ page.difficulty }}
              </v-chip>
              <v-chip color="purple" size="small" variant="outlined">
                {{ page.estimatedReadTime }} min read
              </v-chip>
            </div>
            <div class="flex flex-wrap gap-1 mb-3">
              <v-chip 
                v-for="tag in page.tags.slice(0, 3)" 
                :key="tag"
                size="x-small" 
                variant="tonal"
                color="grey"
              >
                {{ tag }}
              </v-chip>
            </div>
          </div>
          <NuxtLink 
            :to="page.path" 
            :class="getButtonColor(page.category)"
            class="px-4 py-2 rounded-lg text-white transition-colors inline-block"
          >
            View Documentation
          </NuxtLink>
        </div>
      </div>

      <!-- Quick Access Section -->
      <div class="mt-12 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h3 class="text-2xl font-bold text-white mb-4">Quick Access</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NuxtLink 
            to="/sys" 
            class="text-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <v-icon color="blue" size="large" class="mb-2">mdi-view-dashboard</v-icon>
            <p class="text-white text-sm">System Admin</p>
          </NuxtLink>
          <NuxtLink 
            to="/admin" 
            class="text-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <v-icon color="green" size="large" class="mb-2">mdi-account-supervisor</v-icon>
            <p class="text-white text-sm">Admin Dashboard</p>
          </NuxtLink>
          <NuxtLink 
            to="/admin/users" 
            class="text-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <v-icon color="yellow" size="large" class="mb-2">mdi-account-group</v-icon>
            <p class="text-white text-sm">User Management</p>
          </NuxtLink>
          <NuxtLink 
            to="/admin/monitor" 
            class="text-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <v-icon color="red" size="large" class="mb-2">mdi-monitor-dashboard</v-icon>
            <p class="text-white text-sm">System Monitor</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

definePageMeta({
  middleware: 'admin',
  layout: 'admin'
})

const authStore = useAuthStore()
const docStore = useDocumentationStore()

// Redirect non-admin users
if (!authStore.isAdmin) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin access required for documentation'
  })
}

// Initialize documentation store
onMounted(async () => {
  if (docStore.pages.length === 0) {
    await docStore.initialize()
  }
})

// Helper functions for styling
const getIconColor = (category) => {
  const colors = {
    'Architecture': 'blue',
    'Development': 'yellow', 
    'Security': 'red',
    'Administration': 'indigo'
  }
  return colors[category] || 'purple'
}

const getDifficultyColor = (difficulty) => {
  const colors = {
    'Beginner': 'green',
    'Intermediate': 'orange',
    'Advanced': 'red'
  }
  return colors[difficulty] || 'grey'
}

const getButtonColor = (category) => {
  const colors = {
    'Architecture': 'bg-blue-600 hover:bg-blue-700',
    'Development': 'bg-yellow-600 hover:bg-yellow-700',
    'Security': 'bg-red-600 hover:bg-red-700',
    'Administration': 'bg-indigo-600 hover:bg-indigo-700'
  }
  return colors[category] || 'bg-purple-600 hover:bg-purple-700'
}
</script>
