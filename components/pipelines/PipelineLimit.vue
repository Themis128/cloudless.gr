<template>
  <div>
    <!-- Pipeline Limits -->
    <v-card class="mb-6 bg-gradient-info">
      <v-card-text class="text-center py-6">
        <v-icon size="48" color="white" class="mb-4">
          mdi-pipe
        </v-icon>
        <h2 class="text-h5 font-weight-bold text-white mb-2">
          Pipeline Usage
        </h2>
        <p class="text-white/90 mb-4">
          Monitor your pipeline creation and execution limits
        </p>
        
        <!-- Usage Stats -->
        <v-row class="justify-center">
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-white">{{ pipelineUsage.created }}</div>
              <div class="text-white/80">Created</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-white">{{ pipelineUsage.limit }}</div>
              <div class="text-white/80">Limit</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-white">{{ pipelineUsage.remaining }}</div>
              <div class="text-white/80">Remaining</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-white">{{ usagePercentage }}%</div>
              <div class="text-white/80">Used</div>
            </div>
          </v-col>
        </v-row>

        <!-- Progress Bar -->
        <v-progress-linear
          :model-value="usagePercentage"
          color="white"
          height="8"
          class="mt-4"
          rounded
        >
          <template v-slot:default="{ value }">
            <strong>{{ Math.ceil(value) }}%</strong>
          </template>
        </v-progress-linear>

        <!-- Warning/Info Messages -->
        <v-alert
          v-if="usagePercentage >= 90"
          type="warning"
          variant="tonal"
          class="mt-4"
          color="white"
        >
          <strong>Warning:</strong> You're approaching your pipeline limit. Consider upgrading your plan.
        </v-alert>
        <v-alert
          v-else-if="usagePercentage >= 75"
          type="info"
          variant="tonal"
          class="mt-4"
          color="white"
        >
          <strong>Info:</strong> You have {{ pipelineUsage.remaining }} pipelines remaining.
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'

const pipelineStore = usePipelineStore()

// Mock data - in a real app, this would come from user subscription/limits
const pipelineUsage = computed(() => {
  const created = pipelineStore.allPipelines.length
  const limit = 50 // This would come from user's subscription
  const remaining = Math.max(0, limit - created)
  
  return {
    created,
    limit,
    remaining
  }
})

const usagePercentage = computed(() => {
  if (pipelineUsage.value.limit === 0) return 0
  return Math.round((pipelineUsage.value.created / pipelineUsage.value.limit) * 100)
})
</script>

<style scoped>
.bg-gradient-info {
  background: linear-gradient(135deg, #2196f3 0%, #21cbf3 100%);
}
</style> 