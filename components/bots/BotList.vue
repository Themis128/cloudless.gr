<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-robot</v-icon>
        {{ t('bots.manage') }}
      </div>
      <div class="d-flex align-center">
        <!-- Language Selector -->
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              icon="mdi-translate"
              variant="text"
              v-bind="props"
              class="mr-2"
            />
          </template>
          <v-list>
            <v-list-item
              v-for="locale in availableLocales"
              :key="locale.code"
              @click="switchLanguage(locale.code)"
            >
              <v-list-item-title>{{ locale.name }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        
        <!-- Export Button -->
        <v-btn
          v-if="isExportEnabled"
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-download"
          size="small"
          class="mr-2"
          @click="exportBots"
          :loading="exporting"
        >
          {{ t('bots.actions.export') }}
        </v-btn>
        
        <!-- Create Bot Button -->
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="$emit('create-bot')"
        >
          {{ t('bots.create') }}
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <!-- Search and Filter -->
      <div class="d-flex align-center mb-4">
        <v-text-field
          v-model="searchQuery"
          :placeholder="t('common.search')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          class="mr-4"
          style="max-width: 300px;"
        />
        
        <v-select
          v-model="statusFilter"
          :items="statusOptions"
          variant="outlined"
          density="compact"
          class="mr-4"
          style="max-width: 150px;"
        />
        
        <v-select
          v-model="sortBy"
          :items="sortOptions"
          variant="outlined"
          density="compact"
          class="mr-4"
          style="max-width: 150px;"
        />
        
        <v-btn
          icon="mdi-sort-variant"
          variant="text"
          @click="toggleSortOrder"
        />
      </div>

      <!-- Bot Limit Warning -->
      <v-alert
        v-if="isAtLimit"
        type="warning"
        variant="tonal"
        class="mb-4"
      >
        {{ $t('bots.messages.limitReached', { limit: config.public.maxBotsPerUser }) }}
      </v-alert>

      <div v-if="botStore.loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
        <div class="mt-4 text-body-2">{{ t('bots.messages.loading') }}</div>
      </div>

      <div v-else-if="botStore.error" class="text-center py-8">
        <v-alert type="error" class="mb-4">
          {{ botStore.error }}
        </v-alert>
        <v-btn color="primary" @click="botStore.fetchAll">
          {{ t('bots.messages.retry') }}
        </v-btn>
      </div>

      <div v-else-if="filteredBots.length === 0" class="text-center py-8">
        <v-icon size="64" color="grey" class="mb-4">mdi-robot-off</v-icon>
        <h3 class="text-h6 mb-2">{{ t('bots.messages.noBots') }}</h3>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t('bots.messages.createFirst') }}
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="$emit('create-bot')"
        >
                      {{ t('bots.actions.create') }}
        </v-btn>
      </div>

      <div v-else>
        <!-- Analytics Summary -->
        <v-card v-if="isAnalyticsEnabled" variant="outlined" class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="3">
                <div class="text-center">
                  <div class="text-h4 font-weight-bold text-primary">{{ botStats.total }}</div>
                  <div class="text-caption">{{ t('bots.stats.total') }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="text-center">
                  <div class="text-h4 font-weight-bold text-success">{{ botStats.active }}</div>
                  <div class="text-caption">{{ t('bots.stats.active') }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="text-center">
                  <div class="text-h4 font-weight-bold text-info">{{ botStats.training }}</div>
                  <div class="text-caption">{{ t('bots.stats.training') }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="text-center">
                  <div class="text-h4 font-weight-bold text-warning">{{ performanceTrends.averageResponseTime.toFixed(1) }}ms</div>
                  <div class="text-caption">Avg Response Time</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-row>
          <v-col
            v-for="bot in filteredBots"
            :key="bot.id"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card variant="outlined" class="h-100">
              <v-card-title class="d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <NuxtImg
                    :src="bot.avatar || '/default-bot.png'"
                    :alt="bot.name"
                    width="32"
                    height="32"
                    class="mr-2 rounded"
                    loading="lazy"
                  />
                  {{ formatBotName(bot.name) }}
                </div>
                <v-chip
                  :color="getBotStatusColor(bot.status)"
                  size="small"
                  variant="tonal"
                >
                  {{ t(`bots.status.${bot.status}`) }}
                </v-chip>
              </v-card-title>

              <v-card-text>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  {{ bot.description || 'No description provided' }}
                </p>
                
                <div class="text-caption text-medium-emphasis mb-4">
                  <div class="d-flex align-center mb-1">
                    <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                    Created: {{ formatBotDate(bot.createdAt) }}
                  </div>
                  <div class="d-flex align-center">
                    <v-icon size="16" class="mr-1">mdi-update</v-icon>
                    Updated: {{ formatBotDate(bot.updatedAt) }}
                  </div>
                </div>

                <div v-if="bot.config" class="mb-4">
                  <div class="text-caption font-weight-medium mb-2">Configuration:</div>
                  <v-chip
                    v-if="bot.config.model"
                    size="small"
                    variant="outlined"
                    class="mr-2 mb-2"
                  >
                    {{ bot.config.model }}
                  </v-chip>
                  <v-chip
                    v-if="bot.config.memory"
                    size="small"
                    variant="outlined"
                    class="mr-2 mb-2"
                  >
                    {{ bot.config.memory }} tokens
                  </v-chip>
                </div>

                <!-- Performance Metrics -->
                <div v-if="isAnalyticsEnabled && bot.config" class="mb-4">
                  <div class="text-caption font-weight-medium mb-2">Performance:</div>
                  <v-row>
                    <v-col cols="6">
                      <div class="text-caption">
                        Response: {{ (bot.config.responseTime || 0).toFixed(1) }}ms
                      </div>
                    </v-col>
                    <v-col cols="6">
                      <div class="text-caption">
                        Accuracy: {{ (bot.config.accuracy || 0).toFixed(1) }}%
                      </div>
                    </v-col>
                  </v-row>
                </div>
              </v-card-text>

              <v-card-actions>
                <v-btn
                  color="primary"
                  variant="text"
                  size="small"
                  :to="`/bots/${bot.id}`"
                  @click="logBotAction('view', bot.id)"
                >
                  {{ t('bots.view') }}
                </v-btn>
                <v-btn
                  color="info"
                  variant="text"
                  size="small"
                  :to="`/bots/${bot.id}/test`"
                  @click="logBotAction('test', bot.id)"
                >
                  {{ t('bots.test') }}
                </v-btn>
                <v-spacer />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="deleteBot(bot.id)"
                  :loading="botStore.loading"
                />
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card-text>

    <v-alert v-if="botStore.success" type="success" class="mt-2">
      {{ botStore.success }}
    </v-alert>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBotStore } from '~/stores/botStore'
import { useBotDebug } from '~/composables/useBotDebug'
import { 
  formatBotName, 
  getBotStatusColor, 
  formatBotDate, 
  filterBotsByStatus, 
  searchBots, 
  sortBots,
  exportBotData 
} from '~/utils/botHelpers'

const emit = defineEmits<{
  'create-bot': []
}>()

const botStore = useBotStore()
const { logBotAction } = useBotDebug()
const config = useRuntimeConfig()

// Internationalization
const { t, switchLanguage, availableLocales } = useI18n()

// Search and filter
const searchQuery = ref('')
const statusFilter = ref('all')
const sortBy = ref('name')
const sortOrder = ref<'asc' | 'desc'>('asc')
const exporting = ref(false)

const statusOptions = [
  { title: 'All', value: 'all' },
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
  { title: 'Training', value: 'training' }
]

const sortOptions = [
  { title: 'Name', value: 'name' },
  { title: 'Status', value: 'status' },
  { title: 'Created', value: 'createdAt' },
  { title: 'Updated', value: 'updatedAt' }
]

// Computed properties for analytics data from botStore
const botStats = computed(() => {
  const bots = botStore.bots
  return {
    total: bots.length,
    active: bots.filter(bot => bot.status === 'active').length,
    inactive: bots.filter(bot => bot.status === 'inactive').length,
    training: bots.filter(bot => bot.status === 'training').length
  }
})

const performanceTrends = computed(() => {
  const bots = botStore.bots
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

const isAnalyticsEnabled = computed(() => botStore.bots.length > 0)

const filteredBots = computed(() => {
  let bots = botStore.bots
  
  // Filter by status
  if (statusFilter.value !== 'all') {
    bots = filterBotsByStatus(bots, statusFilter.value)
  }
  
  // Search
  if (searchQuery.value) {
    bots = searchBots(bots, searchQuery.value)
  }
  
  // Sort
  bots = sortBots(bots, sortBy.value, sortOrder.value)
  
  return bots
})

const isAtLimit = computed(() => {
  return botStore.bots.length >= config.public.maxBotsPerUser
})

const isExportEnabled = computed(() => {
  return config.public.botFeatures.enableExport
})

// Methods
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

const deleteBot = async (botId: number) => {
      if (confirm(t('bots.messages.deleteConfirm'))) {
    logBotAction('delete', botId)
    await botStore.deleteBot(botId)
  }
}

const exportBots = async () => {
  exporting.value = true
  try {
    const data = exportBotData(botStore.bots)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bots-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  botStore.fetchAll()
})
</script> 