<template>
  <CardLayout :loading="loading">
    <template #header>
      <div class="d-flex justify-space-between align-center w-100">
        <span class="text-h6">{{ title }}</span>
        <v-icon :color="iconColor" size="24">
          {{ icon }}
        </v-icon>
      </div>
    </template>
    
    <template #content>
      <div class="text-center">
        <div class="metric-value text-h3 font-weight-bold" :style="{ color: valueColor }">
          {{ value }}
        </div>
        <div class="metric-subtitle text-body-2 text-medium-emphasis mt-2">
          {{ subtitle }}
        </div>
        
        <!-- Trend indicator -->
        <div v-if="trend" class="trend-indicator mt-2">
          <v-chip
            :color="trend.color"
            size="small"
            variant="tonal"
            class="trend-chip"
          >
            <v-icon
              :icon="getTrendIcon(trend.direction)"
              size="16"
              class="mr-1"
            />
            {{ formatTrendValue(trend.value, trend.direction) }}
          </v-chip>
        </div>
      </div>
    </template>
  </CardLayout>
</template>

<script setup lang="ts">
import CardLayout from './CardLayout.vue'

interface Trend {
  value: number
  direction: 'up' | 'down' | 'neutral'
  color: string
}

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  iconColor?: string
  valueColor?: string
  loading?: boolean
  trend?: Trend
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  iconColor: 'primary',
  valueColor: 'primary',
  loading: false
})

const getTrendIcon = (direction: string) => {
  switch (direction) {
    case 'up':
      return 'mdi-trending-up'
    case 'down':
      return 'mdi-trending-down'
    default:
      return 'mdi-minus'
  }
}

const formatTrendValue = (value: number, direction: string) => {
  if (direction === 'neutral') {
    return `${value}%`
  }
  return `${direction === 'up' ? '+' : '-'}${value}%`
}
</script>

<style scoped>
.metric-value {
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.metric-subtitle {
  font-size: 0.875rem;
  opacity: 0.7;
}

.trend-indicator {
  display: flex;
  justify-content: center;
}

.trend-chip {
  font-size: 0.75rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .metric-value {
    font-size: 2rem;
  }
}
</style> 