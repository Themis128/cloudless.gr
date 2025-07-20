<template>
  <div>
    <v-container>
      <h1 class="mb-4">
        Debug Dashboard
      </h1>
      
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
import DebugConsole from '~/components/debug/DebugConsole.vue'
import { useDebugTools } from '~/composables/useDebugTools'

const { logs, handleCommand } = useDebugTools()

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
