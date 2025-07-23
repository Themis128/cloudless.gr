<template>
  <div>
    <PageStructure
      title="System Overview"
      subtitle="Monitor your AI infrastructure performance and metrics"
      :show-back-button="false"
    >
      <template #main>
        <!-- Action Cards from Store -->
        <ActionCard
          v-for="card in dashboardStore.actionCards"
          :key="card.id"
          :title="card.title"
          :subtitle="card.subtitle"
          :loading="card.loading"
          :actions="card.actions"
        />

        <!-- Error Alert -->
        <v-alert
          v-if="dashboardStore.error"
          type="error"
          variant="flat"
          class="mt-4"
          :text="dashboardStore.error"
        >
          <template v-slot:append>
            <v-btn
              color="error"
              variant="text"
              @click="dashboardStore.fetchDashboardData"
              prepend-icon="mdi-refresh"
            >
              Retry
            </v-btn>
          </template>
        </v-alert>

        <!-- Metric Cards from Store -->
        <v-row>
          <v-col
            v-for="metric in dashboardStore.metricCards"
            :key="metric.id"
            cols="12"
            sm="6"
            md="3"
          >
            <MetricCard
              :title="metric.title"
              :value="metric.value"
              :subtitle="metric.subtitle"
              :icon="metric.icon"
              :icon-color="metric.iconColor"
              :value-color="metric.valueColor"
              :loading="metric.loading"
              :trend="metric.trend"
            />
          </v-col>
        </v-row>

        <!-- Latency Chart -->
        <v-card class="bg-white mt-6">
          <v-card-title>
            <v-icon start color="primary">
              mdi-chart-line
            </v-icon>
            Latency History
          </v-card-title>
          <v-card-text>
            <client-only>
              <VChart :option="latencyChart" autoresize style="height: 300px" />
            </client-only>
          </v-card-text>
        </v-card>

        <!-- Redis Analytics Section -->
        <v-card class="bg-white mt-6">
          <v-card-title class="d-flex justify-space-between align-center">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-database
              </v-icon>
              Redis Analytics
            </div>
            <v-btn
              color="primary"
              variant="outlined"
              size="small"
              to="/admin/redis-analytics"
            >
              View Full Analytics
            </v-btn>
          </v-card-title>
          <v-card-text>
            <RedisAnalytics />
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <AnalyticsGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent } from 'vue'
import { useDashboardStore } from '~/stores/dashboardStore'
import PageStructure from '~/components/layout/PageStructure.vue'
import AnalyticsGuide from '~/components/step-guides/AnalyticsGuide.vue'
import RedisAnalytics from '~/components/admin/RedisAnalytics.vue'
import ActionCard from '~/components/ui/ActionCard.vue'
import MetricCard from '~/components/ui/MetricCard.vue'

// Client-side only import for VChart
const VChart = defineAsyncComponent(() => import('vue-echarts'))

// Store
const dashboardStore = useDashboardStore()

// Latency data
const latencyHistory = ref<number[]>([])

// 📊 Latency chart configuration
const latencyChart = computed(() => ({
  title: {
    text: 'Response Time (ms)',
    left: 'center',
    textStyle: {
      fontSize: 14,
      fontWeight: 'normal'
    }
  },
  tooltip: {
    trigger: 'axis'
  },
  xAxis: {
    type: 'category',
    data: Array.from({ length: latencyHistory.value.length }, (_, i) => i + 1)
  },
  yAxis: {
    type: 'value',
    name: 'ms'
  },
  series: [{
    data: latencyHistory.value,
    type: 'line',
    smooth: true,
    color: '#1976d2',
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [{
          offset: 0, color: 'rgba(25, 118, 210, 0.3)'
        }, {
          offset: 1, color: 'rgba(25, 118, 210, 0.1)'
        }]
      }
    }
  }]
}))

// 🚀 Initialize
onMounted(async () => {
  // Fetch dashboard data from store
  await dashboardStore.fetchDashboardData()
  
  // Simulate latency data
  latencyHistory.value = Array.from({ length: 20 }, () => 
    Math.random() * 100 + 50
  )
})
</script>

<style scoped>
.stats-card {
  transition: transform 0.2s ease-in-out;
}

.stats-card:hover {
  transform: translateY(-2px);
}
</style>
