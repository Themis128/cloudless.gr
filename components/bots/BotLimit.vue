<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-gauge</v-icon>
      Bot Usage
    </v-card-title>
    
    <v-card-text>
      <div class="d-flex align-center justify-space-between mb-4">
        <div>
          <div class="text-h4 font-weight-bold" :class="usageColor">
            {{ botStore.bots.length }}/{{ config.public.maxBotsPerUser }}
          </div>
          <div class="text-caption text-medium-emphasis">Bots Created</div>
        </div>
        
        <v-progress-circular
          :model-value="usagePercentage"
          :color="usageColor"
          :size="80"
          :width="8"
        >
          <span class="text-h6 font-weight-bold">{{ Math.round(usagePercentage) }}%</span>
        </v-progress-circular>
      </div>
      
      <v-progress-linear
        :model-value="usagePercentage"
        :color="usageColor"
        height="8"
        rounded
        class="mb-4"
      />
      
      <div class="d-flex justify-space-between text-caption">
        <span>0</span>
        <span>{{ config.public.maxBotsPerUser }}</span>
      </div>
      
      <v-alert
        v-if="isAtLimit"
        type="warning"
        variant="tonal"
        class="mt-4"
      >
        <template #prepend>
          <v-icon>mdi-alert</v-icon>
        </template>
        You've reached the maximum number of bots ({{ config.public.maxBotsPerUser }}).
        <v-btn
          color="warning"
          variant="text"
          size="small"
          class="ml-2"
          @click="upgradePlan"
        >
          Upgrade Plan
        </v-btn>
      </v-alert>
      
      <v-alert
        v-else-if="isNearLimit"
        type="info"
        variant="tonal"
        class="mt-4"
      >
        <template #prepend>
          <v-icon>mdi-information</v-icon>
        </template>
        You're approaching the bot limit. {{ remainingBots }} bots remaining.
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBotStore } from '~/stores/botStore'

const botStore = useBotStore()
const config = useRuntimeConfig()

const usagePercentage = computed(() => {
  return (botStore.bots.length / config.public.maxBotsPerUser) * 100
})

const usageColor = computed(() => {
  if (usagePercentage.value >= 90) return 'error'
  if (usagePercentage.value >= 75) return 'warning'
  return 'success'
})

const isAtLimit = computed(() => {
  return botStore.bots.length >= config.public.maxBotsPerUser
})

const isNearLimit = computed(() => {
  return usagePercentage.value >= 75 && !isAtLimit.value
})

const remainingBots = computed(() => {
  return config.public.maxBotsPerUser - botStore.bots.length
})

const upgradePlan = () => {
  // Navigate to upgrade page or show upgrade modal
  window.location.href = '/upgrade'
}
</script> 