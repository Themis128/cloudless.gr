<template>
  <div class="navigation-demo p-6 bg-gray-50 rounded-lg">
    <h3 class="text-lg font-semibold mb-4">Navigation Store Demo</h3>
    
    <!-- Current Navigation State -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">Current State:</h4>
      <div class="space-y-1 text-sm">
        <div><strong>Current Route:</strong> {{ navigationStore.currentRoute || 'None' }}</div>
        <div><strong>Previous Route:</strong> {{ navigationStore.previousRoute || 'None' }}</div>
        <div><strong>Pending Redirect:</strong> {{ navigationStore.pendingRedirect || 'None' }}</div>
        <div><strong>Is Navigating:</strong> {{ navigationStore.isNavigating }}</div>
        <div v-if="navigationStore.error" class="text-red-600">
          <strong>Error:</strong> {{ navigationStore.error }}
        </div>
      </div>
    </div>

    <!-- App Configuration Display -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">Centralized App Configuration:</h4>
      <div class="bg-white p-4 rounded border space-y-2 text-sm">
        <div><strong>Base URL:</strong> {{ appConfig.baseUrl }}</div>
        <div><strong>Default Redirect:</strong> {{ appConfig.defaultRedirect }}</div>
        <div><strong>Auth Path:</strong> {{ appConfig.authPath }}</div>
        <div><strong>Admin Path:</strong> {{ appConfig.adminPath }}</div>
      </div>
    </div>

    <!-- URL Builder Demo -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">Centralized URL Building:</h4>
      <div class="bg-white p-4 rounded border space-y-2 text-sm">
        <div><strong>Auth URL (no redirect):</strong> {{ navigationStore.buildAuthUrl() }}</div>
        <div><strong>Auth URL (to /users):</strong> {{ navigationStore.buildAuthUrl('/users') }}</div>
        <div><strong>Auth URL (to current path):</strong> {{ navigationStore.buildAuthUrl($route?.path) }}</div>
        <div><strong>Admin URL:</strong> {{ navigationStore.buildUrl('/admin') }}</div>
        <div><strong>Profile URL:</strong> {{ navigationStore.buildUrl('/users/profile') }}</div>
      </div>
    </div>

    <!-- Navigation History -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">Navigation History (Last 5):</h4>
      <div class="space-y-1 text-sm">
        <div v-if="navigationStore.navigationHistory.length === 0" class="text-gray-500">
          No history yet
        </div>
        <div 
          v-for="(route, index) in navigationStore.navigationHistory.slice(-5)" 
          v-else 
          :key="index"
          class="px-2 py-1 bg-white rounded border"
        >
          {{ route }}
        </div>
      </div>
    </div>

    <!-- Route Categories -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">Route Categories:</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <h5 class="font-medium text-green-600 mb-1">Public Routes:</h5>
          <div class="space-y-1">
            <div v-for="route in navigationStore.getPublicRoutes()" :key="route.path" class="text-xs">
              {{ route.path }}
            </div>
          </div>
        </div>
        <div>
          <h5 class="font-medium text-blue-600 mb-1">Authenticated Routes:</h5>
          <div class="space-y-1">
            <div v-for="route in navigationStore.getAuthenticatedRoutes()" :key="route.path" class="text-xs">
              {{ route.path }}
            </div>
          </div>
        </div>
        <div>
          <h5 class="font-medium text-red-600 mb-1">Admin Routes:</h5>
          <div class="space-y-1">
            <div v-for="route in navigationStore.getAdminRoutes()" :key="route.path" class="text-xs">
              {{ route.path }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Test Navigation Buttons -->
    <div class="space-y-2">
      <h4 class="font-medium mb-2">Test Navigation:</h4>
      <div class="flex flex-wrap gap-2">
        <button 
          class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600" 
          @click="testNavigation('/')"
        >
          Home
        </button>
        <button 
          class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600" 
          @click="testNavigation('/auth')"
        >
          Auth
        </button>
        <button 
          class="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600" 
          @click="testNavigation('/users')"
        >
          Users
        </button>
        <button 
          class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600" 
          @click="testNavigation('/admin')"
        >
          Admin
        </button>
        <button 
          class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600" 
          @click="navigationStore.goBack()"
        >
          Go Back
        </button>
        <button 
          class="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600" 
          @click="navigationStore.clearError()"
        >
          Clear Error
        </button>
      </div>
    </div>

    <!-- Access Check Results -->
    <div v-if="lastAccessCheck" class="mt-6 p-4 bg-white rounded border">
      <h4 class="font-medium mb-2">Last Access Check:</h4>
      <div class="text-sm space-y-1">
        <div><strong>Path:</strong> {{ lastAccessCheck.path }}</div>
        <div><strong>Can Access:</strong> 
          <span :class="lastAccessCheck.result.canAccess ? 'text-green-600' : 'text-red-600'">
            {{ lastAccessCheck.result.canAccess ? 'Yes' : 'No' }}
          </span>
        </div>
        <div v-if="lastAccessCheck.result.reason">
          <strong>Reason:</strong> {{ lastAccessCheck.result.reason }}
        </div>
        <div v-if="lastAccessCheck.result.redirectTo">
          <strong>Redirect To:</strong> {{ lastAccessCheck.result.redirectTo }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/authStore'
import { useNavigationStore } from '~/stores/navigationStore'

// Type for access check result
interface AccessCheckResult {
  canAccess: boolean
  reason?: string
  redirectTo?: string
}

// Initialize stores
const authStore = useAuthStore()
const navigationStore = useNavigationStore()

// Get app configuration
const appConfig = navigationStore.getAppConfig()

// Local state for demo
const lastAccessCheck = ref<{ path: string; result: AccessCheckResult } | null>(null)

// Test navigation function
const testNavigation = async (path: string) => {
  try {
    console.log(`[NavigationDemo] Testing navigation to: ${path}`)
    
    // Check access first
    const accessResult = navigationStore.canAccessRoute(path)
    lastAccessCheck.value = { path, result: accessResult }
    
    console.log(`[NavigationDemo] Access check result:`, accessResult)
    
    // Attempt navigation
    if (accessResult.canAccess) {
      await navigationStore.navigateTo(path)
    } else {
      console.log(`[NavigationDemo] Access denied for ${path}:`, accessResult.reason)
    }
  } catch (error) {
    console.error(`[NavigationDemo] Navigation error:`, error)
  }
}

// Initialize on mount
onMounted(async () => {
  try {
    console.log('[NavigationDemo] Initializing stores...')
    await authStore.initialize()
    
    // Initialize with current path or default
    navigationStore.initialize('/test-stores')
    
    console.log('[NavigationDemo] Stores initialized successfully')
  } catch (error) {
    console.error('[NavigationDemo] Initialization error:', error)
  }
})
</script>
