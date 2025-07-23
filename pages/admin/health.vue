<template>
  <div class="admin-health">
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-heart-pulse</v-icon>
              System Health
            </v-card-title>
            
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-card variant="outlined" class="mb-4">
                    <v-card-title>Database Status</v-card-title>
                    <v-card-text>
                      <div class="d-flex align-center">
                        <v-icon 
                          :color="dbStatus === 'healthy' ? 'success' : 'error'"
                          class="mr-2"
                        >
                          {{ dbStatus === 'healthy' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                        </v-icon>
                        <span>{{ dbStatus === 'healthy' ? 'Connected' : 'Connection Error' }}</span>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-card variant="outlined" class="mb-4">
                    <v-card-title>Redis Status</v-card-title>
                    <v-card-text>
                      <div class="d-flex align-center">
                        <v-icon 
                          :color="redisStatus === 'healthy' ? 'success' : 'error'"
                          class="mr-2"
                        >
                          {{ redisStatus === 'healthy' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                        </v-icon>
                        <span>{{ redisStatus === 'healthy' ? 'Connected' : 'Connection Error' }}</span>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
              
              <v-card variant="outlined">
                <v-card-title>System Information</v-card-title>
                <v-card-text>
                  <v-list>
                    <v-list-item>
                      <v-list-item-title>Node.js Version</v-list-item-title>
                      <v-list-item-subtitle>{{ systemInfo.nodeVersion }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Environment</v-list-item-title>
                      <v-list-item-subtitle>{{ systemInfo.environment }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Uptime</v-list-item-title>
                      <v-list-item-subtitle>{{ systemInfo.uptime }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Define the layout and middleware
// @ts-ignore - definePageMeta is auto-imported by Nuxt
definePageMeta({
  layout: 'default',
  middleware: 'admin'
})

// Type definitions for API responses
interface HealthResponse {
  status: 'healthy' | 'error'
  message?: string
}

interface SystemInfo {
  nodeVersion: string
  environment: string
  uptime: string
}

const dbStatus = ref('checking')
const redisStatus = ref('checking')
const systemInfo = ref<SystemInfo>({
  nodeVersion: 'Unknown',
  environment: process.env.NODE_ENV || 'development',
  uptime: 'Unknown'
})

const checkHealth = async () => {
  try {
    // Check database health
    const dbResponse = await $fetch<HealthResponse>('/api/health/database')
    dbStatus.value = dbResponse.status === 'healthy' ? 'healthy' : 'error'
  } catch (error) {
    console.error('Database health check failed:', error)
    dbStatus.value = 'error'
  }
  
  try {
    // Check Redis health
    const redisResponse = await $fetch<HealthResponse>('/api/health/redis')
    redisStatus.value = redisResponse.status === 'healthy' ? 'healthy' : 'error'
  } catch (error) {
    console.error('Redis health check failed:', error)
    redisStatus.value = 'error'
  }
  
  try {
    // Get system info
    const systemResponse = await $fetch<SystemInfo>('/api/health/system')
    systemInfo.value = systemResponse
  } catch (error) {
    console.error('System info fetch failed:', error)
  }
}

onMounted(() => {
  checkHealth()
  // Refresh every 30 seconds
  setInterval(checkHealth, 30000)
})
</script>

<style scoped>
.admin-health {
  padding: 20px 0;
}
</style> 