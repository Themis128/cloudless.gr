<template>
  <div>
    <AnalyticsGuide />
    <v-container>
      <h1 class="mb-4">
        System Overview
      </h1>

      <v-row>
        <!-- Metric Cards -->
        <v-col
          v-for="metric in metrics"
          :key="metric.label"
          cols="12"
          sm="6"
          md="3"
        >
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <span>{{ metric.label }}</span>
              <v-icon :color="metric.color">
                {{ metric.icon }}
              </v-icon>
            </v-card-title>
            <v-card-text class="text-h5">
              {{ metric.value }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Latency Chart -->
      <v-card class="mt-6">
        <v-card-title>Latency History</v-card-title>
        <v-card-text>
          <client-only>
            <VChart :option="latencyChart" autoresize style="height: 300px" />
          </client-only>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AnalyticsGuide from '~/components/step-guides/AnalyticsGuide.vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'

const supabase = useSupabase()

const bots = ref(0)
const pipelines = ref(0)
const models = ref(0)
const latencyHistory = ref<number[]>([])

// 📊 Fetch metrics
onMounted(async () => {
  // Bots count
  const { count: botCount } = await supabase
    .from('bots')
    .select('*', { count: 'exact', head: true })
  bots.value = botCount || 0

  // Pipelines count (active)
  const { count: activePipes } = await supabase
    .from('pipelines')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  pipelines.value = activePipes || 0

  // Models count
  const { count: modelCount } = await supabase
    .from('models')
    .select('*', { count: 'exact', head: true })
  models.value = modelCount || 0

  // Latency logs
  const { data: latencyLogs } = await supabase
    .from('network_logs')
    .select('latency')
    .order('created_at', { ascending: false })
    .limit(10)
  latencyHistory.value =
    (
      latencyLogs as
        | Database['public']['Tables']['network_logs']['Row'][]
        | null
    )?.map(log => log.latency) || []
})

const avgLatency = computed(() => {
  const sum = latencyHistory.value.reduce((a, b) => a + b, 0)
  return latencyHistory.value.length
    ? Math.round(sum / latencyHistory.value.length)
    : 0
})

const metrics = computed(() => [
  {
    label: 'Total Bots',
    value: bots.value,
    icon: 'mdi-robot',
    color: 'primary',
  },
  {
    label: 'Active Pipelines',
    value: pipelines.value,
    icon: 'mdi-timeline',
    color: 'success',
  },
  {
    label: 'LLMs Trained',
    value: models.value,
    icon: 'mdi-brain',
    color: 'info',
  },
  {
    label: 'Latency (avg)',
    value: avgLatency.value + ' ms',
    icon: 'mdi-speedometer',
    color: 'warning',
  },
])

const latencyChart = computed(() => ({
  xAxis: {
    type: 'category',
    data: latencyHistory.value.map(
      (_, i) => `T-${latencyHistory.value.length - i}`
    ),
  },
  yAxis: {
    type: 'value',
    name: 'ms',
  },
  series: [
    {
      data: latencyHistory.value,
      type: 'line',
      smooth: true,
      areaStyle: {},
    },
  ],
  tooltip: { trigger: 'axis' },
}))
</script>
