<template>
  <div>
    <LayoutPageStructure
      title="Bot Management"
      subtitle="Create, manage, and test your AI bots"
      back-button-to="/"
      :has-sidebar="true"
    >
      <template #main>
        <!-- Welcome Header -->
        <v-card class="mb-6 bg-gradient-primary">
          <v-card-text class="text-center py-8">
            <v-icon size="64" color="white" class="mb-4"> mdi-robot </v-icon>
            <h1 class="text-h3 font-weight-bold text-white mb-4">AI Bot Management</h1>
            <p class="text-h6 text-white/90 mb-6">
              Create, configure, and deploy intelligent AI bots for your applications
            </p>

            <!-- Quick Stats -->
            <v-row class="justify-center">
              <v-col cols="6" md="3">
                <v-card class="text-center bg-transparent" elevation="0">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-white mb-1">{{ botStats.total }}</div>
                    <div class="text-white/80 text-body-2">Total Bots</div>
                    <v-icon color="white" class="mt-2" size="24">mdi-robot</v-icon>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6" md="3">
                <v-card class="text-center bg-transparent" elevation="0">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-white mb-1">
                      {{ botStats.active }}
                    </div>
                    <div class="text-white/80 text-body-2">Active Bots</div>
                    <v-icon color="white" class="mt-2" size="24">mdi-robot-outline</v-icon>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6" md="3">
                <v-card class="text-center bg-transparent" elevation="0">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-white mb-1">
                      {{ botStats.training }}
                    </div>
                    <div class="text-white/80 text-body-2">In Training</div>
                    <v-icon color="white" class="mt-2" size="24">mdi-school</v-icon>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6" md="3">
                <v-card class="text-center bg-transparent" elevation="0">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-white mb-1">
                      {{ performanceTrends.averageResponseTime.toFixed(1) }}ms
                    </div>
                    <div class="text-white/80 text-body-2">Avg Response</div>
                    <v-icon color="white" class="mt-2" size="24">mdi-clock-outline</v-icon>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Bot Limit Component -->
        <BotsBotLimit />

        <!-- Bot Analytics Dashboard -->
        <BotsBotAnalytics />

        <!-- Bot List -->
        <BotsBotList @create-bot="showCreateDialog = true" />

        <!-- Create Bot Dialog -->
        <BotsBotBuilderDialog v-model="showCreateDialog" @bot-created="handleBotCreated" />
      </template>

      <template #sidebar>
        <!-- Quick Actions -->
        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-lightning-bolt</v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-btn
              block
              color="primary"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
              class="mb-2"
              :loading="botStore.loading"
              :disabled="botStore.loading"
            >
              Create New Bot
            </v-btn>
            <v-btn
              block
              variant="outlined"
              prepend-icon="mdi-import"
              @click="importBots"
              class="mb-2"
            >
              Import Bots
            </v-btn>
            <v-btn
              block
              variant="outlined"
              prepend-icon="mdi-download"
              @click="exportAllBots"
              :loading="exporting"
            >
              Export All
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- Bot Status Overview -->
        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-chart-pie</v-icon>
            Bot Status
          </v-card-title>
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption">Active</span>
              <v-chip size="small" color="success" variant="tonal">
                {{ botStats.active }}
              </v-chip>
            </div>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption">Inactive</span>
              <v-chip size="small" color="warning" variant="tonal">
                {{ botStats.inactive }}
              </v-chip>
            </div>
            <div class="d-flex align-center justify-space-between">
              <span class="text-caption">Training</span>
              <v-chip size="small" color="info" variant="tonal">
                {{ botStats.training }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>

        <!-- Recent Activity -->
        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-clock-outline</v-icon>
            Recent Activity
          </v-card-title>
          <v-card-text>
            <div
              v-for="bot in recentActivity.slice(0, 5)"
              :key="bot.id"
              class="d-flex align-center mb-3"
            >
              <v-avatar size="24" class="mr-2">
                <v-icon size="16">mdi-robot</v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="text-caption font-weight-medium">{{ bot.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatBotDate(bot.updatedAt) }}
                </div>
              </div>
            </div>
            <div v-if="recentActivity.length === 0" class="text-center py-2">
              <div class="text-caption text-medium-emphasis">No recent activity</div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Help & Resources -->
        <v-card>
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-help-circle</v-icon>
            Help & Resources
          </v-card-title>
          <v-card-text>
            <v-btn
              block
              variant="text"
              prepend-icon="mdi-book-open"
              to="/documentation/bots"
              class="mb-2"
            >
              Documentation
            </v-btn>
            <v-btn block variant="text" prepend-icon="mdi-video" to="/tutorials" class="mb-2">
              Tutorials
            </v-btn>
            <v-btn block variant="text" prepend-icon="mdi-forum" to="/support"> Support </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>

    <!-- Success/Error Messages -->
    <v-snackbar v-model="showSuccess" color="success" timeout="3000">
      {{ successMessage }}
    </v-snackbar>

    <v-snackbar v-model="showError" color="error" timeout="5000">
      {{ errorMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useBotAnalyticsStore } from '~/stores/botAnalyticsStore'
  import { useBotDebugStore } from '~/stores/botDebugStore'
  import { useBotStore } from '~/stores/botStore'
  import { exportBotData, formatBotDate } from '~/utils/botHelpers'

  // SEO Meta Tags
  import { useHead } from 'nuxt/app'

  // TypeScript declaration for Nuxt global functions
  declare const definePageMeta: (meta: any) => void

  useHead({
    title: 'Bot Management - Cloudless',
    meta: [
      {
        name: 'description',
        content: 'Create, manage, and test your AI bots with our comprehensive platform.',
      },
      { property: 'og:title', content: 'Bot Management - Cloudless' },
      { property: 'og:description', content: 'Create, manage, and test your AI bots' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Bot Management - Cloudless' },
      { name: 'twitter:description', content: 'Create, manage, and test your AI bots' },
    ],
  })

  definePageMeta({
    layout: 'default',
  })

  // Types
  interface Bot {
    id: number
    name: string
    description?: string
    status: string
    createdAt: Date
    updatedAt: Date
  }

  // Store integration
  const botStore = useBotStore()
  const botAnalyticsStore = useBotAnalyticsStore()
  const botDebugStore = useBotDebugStore()

  // Computed properties
  const isLoading = computed(() => botStore.loading)

  // Bot statistics
  const botStats = computed(() => {
    const bots = botStore.bots || []
    return {
      total: bots.length,
      active: bots.filter(bot => bot.status === 'active').length,
      inactive: bots.filter(bot => bot.status === 'inactive').length,
      training: bots.filter(bot => bot.status === 'training').length,
    }
  })

  // Performance trends
  const performanceTrends = computed(() => {
    return {
      averageResponseTime: 125.5, // Mock data - replace with actual analytics
    }
  })

  // Recent activity
  const recentActivity = computed(() => {
    const bots = botStore.bots || []
    return bots
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
  })

  // Reactive state
  const showCreateDialog = ref(false)
  const exporting = ref(false)
  const showSuccess = ref(false)
  const showError = ref(false)
  const successMessage = ref('')
  const errorMessage = ref('')

  // Methods
  const handleBotCreated = (bot: Bot) => {
    showSuccess.value = true
    successMessage.value = `Bot "${bot.name}" created successfully!`
    botDebugStore.logBotAction({
      botId: bot.id,
      botName: bot.name,
      action: 'create',
      status: 'success',
      details: `Bot "${bot.name}" created successfully`,
    })
    // Refresh data after creation
    botStore.fetchAll()
  }

  const exportAllBots = async () => {
    exporting.value = true
    try {
      const data = exportBotData(botStore.bots)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `all-bots-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showSuccess.value = true
      successMessage.value = `Exported ${botStore.bots.length} bots successfully!`
      botDebugStore.logBotAction({
        botId: '0',
        botName: 'System',
        action: 'export',
        status: 'success',
        details: `Exported ${botStore.bots.length} bots`,
      })
    } catch (error) {
      showError.value = true
      errorMessage.value = 'Failed to export bots'
      console.error('Export failed:', error)
    } finally {
      exporting.value = false
    }
  }

  const importBots = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const text = await file.text()
          const bots = JSON.parse(text)

          // Validate and import bots
          for (const bot of bots) {
            await botStore.createBot(bot)
          }

          showSuccess.value = true
          successMessage.value = `Imported ${bots.length} bots successfully!`
          botDebugStore.logBotAction({
            botId: '0',
            botName: 'System',
            action: 'import',
            status: 'success',
            details: `Imported ${bots.length} bots`,
          })
          // Refresh data after import
          botStore.fetchAll()
        } catch (error) {
          showError.value = true
          errorMessage.value = 'Failed to import bots. Please check the file format.'
          console.error('Import failed:', error)
        }
      }
    }
    input.click()
  }

  // Client-side initialization
  onMounted(async () => {
    try {
      await botStore.fetchAll()
      // Log page view action
      botDebugStore.logBotAction({
        botId: '0',
        botName: 'System',
        action: 'page_view',
        status: 'success',
        details: 'Viewed bots index page',
      })
    } catch (error) {
      console.error('Failed to fetch bots:', error)
      showError.value = true
      errorMessage.value = 'Failed to load bots data'
    }
  })

  // Watch for store changes
  watch(
    () => botStore.error,
    error => {
      if (error) {
        showError.value = true
        errorMessage.value = error
      }
    }
  )

  watch(
    () => botStore.success,
    success => {
      if (success) {
        showSuccess.value = true
        successMessage.value = success
      }
    }
  )
</script>

<style scoped>
  .bg-gradient-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
</style>
