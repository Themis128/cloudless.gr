<template>
  <v-card v-if="isAnalyticsEnabled" variant="outlined" class="mb-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-chart-line</v-icon>
        Bot Analytics
      </div>
      <v-btn
        color="secondary"
        variant="outlined"
        size="small"
        prepend-icon="mdi-download"
        @click="exportAnalytics"
        :loading="exporting"
      >
        Export Data
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <!-- Performance Overview -->
      <v-row class="mb-6">
        <v-col cols="12" md="3">
          <v-card variant="tonal" color="primary">
            <v-card-text class="text-center">
              <div class="text-h4 font-weight-bold">{{ performanceTrends.averageResponseTime.toFixed(1) }}ms</div>
              <div class="text-caption">Avg Response Time</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="3">
          <v-card variant="tonal" color="success">
            <v-card-text class="text-center">
              <div class="text-h4 font-weight-bold">{{ performanceTrends.averageAccuracy.toFixed(1) }}%</div>
              <div class="text-caption">Avg Accuracy</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="3">
          <v-card variant="tonal" color="info">
            <v-card-text class="text-center">
              <div class="text-h4 font-weight-bold">{{ performanceTrends.totalConversations }}</div>
              <div class="text-caption">Total Conversations</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="3">
          <v-card variant="tonal" color="warning">
            <v-card-text class="text-center">
              <div class="text-h4 font-weight-bold">{{ performanceTrends.averageUptime.toFixed(1) }}%</div>
              <div class="text-caption">Avg Uptime</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      
      <!-- Status Distribution Chart -->
      <v-row class="mb-6">
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title>Status Distribution</v-card-title>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <div class="w-4 h-4 bg-success rounded mr-2"></div>
                <span class="text-caption">Active: {{ statusDistribution.active }}</span>
              </div>
              <div class="d-flex align-center mb-2">
                <div class="w-4 h-4 bg-warning rounded mr-2"></div>
                <span class="text-caption">Inactive: {{ statusDistribution.inactive }}</span>
              </div>
              <div class="d-flex align-center">
                <div class="w-4 h-4 bg-info rounded mr-2"></div>
                <span class="text-caption">Training: {{ statusDistribution.training }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title>Top Performers</v-card-title>
            <v-card-text>
              <div
                v-for="(bot, index) in topPerformers"
                :key="bot.id"
                class="d-flex align-center justify-space-between mb-2"
              >
                <div class="d-flex align-center">
                  <v-icon size="16" class="mr-2" :color="getRankColor(index)">
                    mdi-trophy
                  </v-icon>
                  <span class="text-caption">{{ bot.name }}</span>
                </div>
                <span class="text-caption font-weight-bold">{{ bot.accuracy.toFixed(1) }}%</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      
      <!-- Recent Activity -->
      <v-card variant="outlined">
        <v-card-title>Recent Activity</v-card-title>
        <v-card-text>
          <div
            v-for="bot in recentActivity"
            :key="bot.id"
            class="d-flex align-center justify-space-between mb-3"
          >
            <div class="d-flex align-center">
              <v-avatar size="32" class="mr-3">
                <v-icon>mdi-robot</v-icon>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ bot.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  Updated {{ formatBotDate(bot.updatedAt) }}
                </div>
              </div>
            </div>
            <v-chip
              :color="getBotStatusColor(bot.status)"
              size="small"
              variant="tonal"
            >
              {{ bot.status }}
            </v-chip>
          </div>
          
          <div v-if="recentActivity.length === 0" class="text-center py-4">
            <v-icon size="48" color="grey" class="mb-2">mdi-clock-outline</v-icon>
            <div class="text-caption text-medium-emphasis">No recent activity</div>
          </div>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useBotStore } from '~/stores/botStore'
import { formatBotDate, getBotStatusColor } from '~/utils/botHelpers'

const botStore = useBotStore()
const exporting = ref(false)

// Analytics data from bot store
const isAnalyticsEnabled = computed(() => botStore.allBots.length > 0)

const performanceTrends = computed(() => {
  const bots = botStore.allBots
  if (bots.length === 0) {
    return {
      averageResponseTime: 0,
      averageAccuracy: 0,
      totalConversations: 0,
      averageUptime: 0
    }
  }

  const totalResponseTime = bots.reduce((sum, bot) => sum + (bot.config?.responseTime || 0), 0)
  const totalAccuracy = bots.reduce((sum, bot) => sum + (bot.config?.accuracy || 0), 0)
  const totalConversations = bots.reduce((sum, bot) => sum + (bot.config?.conversations || 0), 0)
  const totalUptime = bots.reduce((sum, bot) => sum + (bot.config?.uptime || 0), 0)

  return {
    averageResponseTime: totalResponseTime / bots.length,
    averageAccuracy: totalAccuracy / bots.length,
    totalConversations,
    averageUptime: totalUptime / bots.length
  }
})

const statusDistribution = computed(() => {
  const bots = botStore.allBots
  return {
    active: bots.filter(bot => bot.status === 'active').length,
    inactive: bots.filter(bot => bot.status === 'inactive').length,
    training: bots.filter(bot => bot.status === 'training').length
  }
})

const recentActivity = computed(() => {
  return botStore.allBots
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
})

const topPerformers = computed(() => {
  return botStore.allBots
    .filter(bot => bot.config?.accuracy)
    .sort((a, b) => (b.config?.accuracy || 0) - (a.config?.accuracy || 0))
    .slice(0, 5)
    .map(bot => ({
      id: bot.id,
      name: bot.name,
      accuracy: bot.config?.accuracy || 0
    }))
})

const getRankColor = (index: number) => {
  switch (index) {
    case 0: return 'amber'
    case 1: return 'grey'
    case 2: return 'orange'
    default: return 'grey'
  }
}

const exportAnalytics = async () => {
  exporting.value = true
  try {
    // Export analytics data
    const analyticsData = {
      performanceTrends: performanceTrends.value,
      statusDistribution: statusDistribution.value,
      recentActivity: recentActivity.value,
      topPerformers: topPerformers.value,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bot-analytics-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  if (botStore.allBots.length === 0) {
    botStore.fetchAll()
  }
})
</script> 