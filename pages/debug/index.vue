<template>
  <div>
    <v-container>
      <h1 class="mb-4">
        Debug Dashboard
      </h1>
      
      <!-- Instructions Section -->
      <DebugInstructions
        :purpose="'The Debug Dashboard provides comprehensive tools for testing, monitoring, and troubleshooting your application. Use these tools to diagnose issues, test functionality, and monitor system performance.'"
        :prerequisites="[
          'Ensure your development server is running',
          'Have access to the application with proper permissions',
          'Familiarize yourself with the specific area you want to debug'
        ]"
        :steps="[
          'Select the appropriate debug tool from the navigation cards below',
          'Read the specific instructions for each tool before using it',
          'Follow the step-by-step process to test or diagnose issues',
          'Review the results and logs for any errors or warnings',
          'Use the troubleshooting guides if you encounter problems'
        ]"
        :tips="[
          'Start with the Network Testing tool to ensure connectivity',
          'Use the Log Management tool to monitor system activity',
          'Test authentication before debugging other features',
          'Keep the debug console open to monitor real-time logs',
          'Export logs for detailed analysis if needed'
        ]"
        :troubleshooting="[
          {
            problem: 'Debug tools not loading or responding',
            solution: 'Check if the development server is running and refresh the page. Ensure you have proper network connectivity.'
          },
          {
            problem: 'Authentication tests failing',
            solution: 'Verify your credentials are correct and the authentication service is running. Check the network connectivity to auth endpoints.'
          },
          {
            problem: 'Model or pipeline tests timing out',
            solution: 'Check if the model service is running and has sufficient resources. Review the logs for specific error messages.'
          }
        ]"
      />
      
      <!-- Debug Navigation Menu -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-title class="text-h6">
              Debug Tools Navigation
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col 
                  v-for="debugPage in debugPages" 
                  :key="debugPage.path"
                  cols="12" 
                  sm="6" 
                  md="4" 
                  lg="3"
                >
                  <v-card
                    :to="debugPage.path"
                    class="debug-nav-card"
                    elevation="2"
                    hover
                  >
                    <v-card-text class="text-center pa-4">
                      <v-icon 
                        :icon="debugPage.icon" 
                        size="48" 
                        :color="debugPage.color"
                        class="mb-3"
                      />
                      <h3 class="text-h6 mb-2">
                        {{ debugPage.title }}
                      </h3>
                      <p class="text-body-2 text-medium-emphasis">
                        {{ debugPage.description }}
                      </p>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Quick Actions -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-title class="text-h6">
              Quick Debug Actions
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6" md="3">
                  <v-btn
                    block
                    color="primary"
                    variant="outlined"
                    prepend-icon="mdi-wifi"
                    @click="testNetwork"
                    :loading="networkLoading"
                  >
                    Test Network
                  </v-btn>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-btn
                    block
                    color="success"
                    variant="outlined"
                    prepend-icon="mdi-database"
                    @click="checkDatabase"
                    :loading="dbLoading"
                  >
                    Check Database
                  </v-btn>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-btn
                    block
                    color="warning"
                    variant="outlined"
                    prepend-icon="mdi-redis"
                    @click="checkRedis"
                    :loading="redisLoading"
                  >
                    Check Redis
                  </v-btn>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-btn
                    block
                    color="info"
                    variant="outlined"
                    prepend-icon="mdi-file-document"
                    @click="exportLogs"
                    :loading="exportLoading"
                  >
                    Export Logs
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Debug Console -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="text-h5">
              Debug Console
            </v-card-title>
            <v-card-text>
              <DebugConsole
                :output="logs"
                title="Debug Console"
                @run="handleCommand"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DebugConsole from '~/components/debug/DebugConsole.vue'
import DebugInstructions from '~/components/debug/DebugInstructions.vue'
import { useDebugTools } from '~/composables/useDebugTools'

const { logs, handleCommand } = useDebugTools()

// Loading states for quick actions
const networkLoading = ref(false)
const dbLoading = ref(false)
const redisLoading = ref(false)
const exportLoading = ref(false)

const debugPages = [
  {
    title: 'Authentication',
    description: 'Test and debug authentication flows, user sessions, and login processes',
    path: '/debug/auth',
    icon: 'mdi-shield-account',
    color: 'primary'
  },
  {
    title: 'Model Testing',
    description: 'Test model inference, performance, and debug model-related issues',
    path: '/debug/model',
    icon: 'mdi-brain',
    color: 'success'
  },
  {
    title: 'Pipeline Debug',
    description: 'Debug data pipelines, execution flows, and pipeline performance',
    path: '/debug/pipeline',
    icon: 'mdi-pipe',
    color: 'info'
  },
  {
    title: 'Network Testing',
    description: 'Test API endpoints, network connectivity, and HTTP requests',
    path: '/debug/network',
    icon: 'mdi-wifi',
    color: 'warning'
  },
  {
    title: 'Log Management',
    description: 'View, manage, and export system logs and debugging information',
    path: '/debug/logs',
    icon: 'mdi-file-document',
    color: 'secondary'
  }
]

// Quick action functions
const testNetwork = async () => {
  networkLoading.value = true
  try {
    window.location.href = '/debug/network'
  } finally {
    networkLoading.value = false
  }
}

const checkDatabase = async () => {
  dbLoading.value = true
  try {
    const response = await $fetch('/api/prisma/health')
    console.log('Database health check:', response)
  } catch (error) {
    console.error('Database check failed:', error)
  } finally {
    dbLoading.value = false
  }
}

const checkRedis = async () => {
  redisLoading.value = true
  try {
    const response = await $fetch('/api/admin/redis-status')
    console.log('Redis status:', response)
  } catch (error) {
    console.error('Redis check failed:', error)
  } finally {
    redisLoading.value = false
  }
}

const exportLogs = async () => {
  exportLoading.value = true
  try {
    window.location.href = '/debug/logs'
  } finally {
    exportLoading.value = false
  }
}
</script>

<style scoped>
.debug-nav-card {
  transition: transform 0.2s ease-in-out;
  cursor: pointer;
}

.debug-nav-card:hover {
  transform: translateY(-4px);
}

.debug-nav-card .v-card-text {
  min-height: 160px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
