<template>
  <div class="max-w-4xl mx-auto p-6 space-y-8">
    <!-- Header -->
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        MCP Server Integration Demo
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Real-time integration with Database and Development MCP servers
      </p>
    </div>

    <!-- Connection Status -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Database Server Status -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Database Server</h3>
          <div class="flex items-center space-x-2">
            <div 
              :class="[
                'w-3 h-3 rounded-full',
                database.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
              ]"
            />
            <span class="text-sm capitalize">{{ database.status }}</span>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ database.name }}</p>
        <div v-if="database.tools.length > 0" class="space-y-2">
          <h4 class="text-sm font-medium">Available Tools ({{ database.tools.length }}):</h4>
          <div class="max-h-32 overflow-y-auto space-y-1">
            <div 
              v-for="tool in database.tools" 
              :key="tool.name"
              class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
            >
              {{ tool.name }}
            </div>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-3">
          Last updated: {{ formatTime(database.lastUpdate) }}
        </p>
      </div>

      <!-- Development Server Status -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Development Server</h3>
          <div class="flex items-center space-x-2">
            <div 
              :class="[
                'w-3 h-3 rounded-full',
                development.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
              ]"
            />
            <span class="text-sm capitalize">{{ development.status }}</span>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ development.name }}</p>
        <div v-if="development.tools.length > 0" class="space-y-2">
          <h4 class="text-sm font-medium">Available Tools ({{ development.tools.length }}):</h4>
          <div class="max-h-32 overflow-y-auto space-y-1">
            <div 
              v-for="tool in development.tools" 
              :key="tool.name"
              class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
            >
              {{ tool.name }}
            </div>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-3">
          Last updated: {{ formatTime(development.lastUpdate) }}
        </p>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap gap-4 justify-center">
      <button 
        :disabled="refreshing"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        @click="handleRefresh"
      >
        <svg
          v-if="refreshing"
          class="animate-spin h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>{{ refreshing ? 'Refreshing...' : 'Refresh Status' }}</span>
      </button>

      <button 
        :disabled="!isReady || testing"
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="testDatabaseQuery"
      >
        {{ testing ? 'Testing...' : 'Test Database' }}
      </button>

      <button 
        :disabled="!isReady || analyzing"
        class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="testProjectAnalysis"
      >
        {{ analyzing ? 'Analyzing...' : 'Analyze Project' }}
      </button>
    </div>

    <!-- Results Display -->
    <div v-if="results.length > 0" class="space-y-4">
      <h3 class="text-lg font-semibold">Test Results:</h3>
      <div class="space-y-3">
        <div 
          v-for="(result, index) in results" 
          :key="index"
          class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border"
        >
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium">{{ result.title }}</h4>
            <span class="text-xs text-gray-500">{{ formatTime(result.timestamp) }}</span>
          </div>
          <div 
            v-if="result.success"
            class="text-sm text-green-700 dark:text-green-400"
          >
            ✅ {{ result.message }}
          </div>
          <div 
            v-else
            class="text-sm text-red-700 dark:text-red-400"
          >
            ❌ {{ result.message }}
          </div>
          <pre 
            v-if="result.data" 
            class="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded border overflow-x-auto"
          >{{ JSON.stringify(result.data, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- Integration Status -->
    <div 
      :class="[
        'text-center p-4 rounded-lg border',
        isReady ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      ]"
    >
      <p class="font-medium">
        {{ isReady ? '🎉 Both MCP servers are connected and ready!' : '⏳ Waiting for MCP servers to connect...' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMcpIntegration } from '~/composables/useMcpIntegration'

// Use the MCP integration composable
const { 
  database, 
  development, 
  isReady, 
  refreshServers,
  queryDatabase,
  analyzeProject
} = useMcpIntegration()

// Page metadata
// @ts-ignore - definePageMeta is a Nuxt compiler macro
definePageMeta({
  title: 'MCP Integration Demo'
})

// Local reactive state
const refreshing = ref(false)
const testing = ref(false)
const analyzing = ref(false)

interface TestResult {
  title: string
  success: boolean
  message: string
  data?: unknown
  timestamp: Date
}

const results = ref<TestResult[]>([])

// Helper function to format timestamps
const formatTime = (date: Date) => {
  return date.toLocaleTimeString()
}

// Manual refresh with loading state
const handleRefresh = async () => {
  refreshing.value = true
  try {
    await refreshServers()
    addResult('Server Status Refresh', true, 'Successfully refreshed MCP server status')
  } catch (error) {
    addResult('Server Status Refresh', false, `Failed to refresh: ${error}`)
  } finally {
    refreshing.value = false
  }
}

// Test database functionality
const testDatabaseQuery = async () => {
  testing.value = true
  try {
    const result = await queryDatabase('SELECT version()')
    addResult('Database Query Test', true, 'Successfully executed database query', result)
  } catch (error) {
    addResult('Database Query Test', false, `Database query failed: ${error}`)
  } finally {
    testing.value = false
  }
}

// Test project analysis
const testProjectAnalysis = async () => {
  analyzing.value = true
  try {
    const result = await analyzeProject()
    addResult('Project Analysis Test', true, 'Successfully analyzed project structure', result)
  } catch (error) {
    addResult('Project Analysis Test', false, `Project analysis failed: ${error}`)
  } finally {
    analyzing.value = false
  }
}

// Helper to add test results
const addResult = (title: string, success: boolean, message: string, data?: unknown) => {
  results.value.unshift({
    title,
    success,
    message,
    data,
    timestamp: new Date()
  })
  
  // Keep only last 10 results
  if (results.value.length > 10) {
    results.value = results.value.slice(0, 10)
  }
}

// Assign handlers to avoid template compilation issues
// const handleRefreshClick = handleRefresh
</script>
