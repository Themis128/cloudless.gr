<template>
  <div>
    <!-- Pipeline Analytics Dashboard -->
    <v-card class="mb-6 bg-white">
      <v-card-title class="d-flex justify-space-between align-center">
        <div class="d-flex align-center">
          <v-icon start color="primary">
            mdi-chart-line
          </v-icon>
          Pipeline Analytics
        </div>
        <v-btn
          color="primary"
          variant="outlined"
          size="small"
          to="/pipelines/analytics"
        >
          View Full Analytics
        </v-btn>
      </v-card-title>
      <v-card-text>
        <!-- Stats Row -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-primary">{{ pipelineStats.total }}</div>
              <div class="text-caption text-medium-emphasis">Total Pipelines</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-success">{{ pipelineStats.active }}</div>
              <div class="text-caption text-medium-emphasis">Active Pipelines</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-info">{{ pipelineStats.running }}</div>
              <div class="text-caption text-medium-emphasis">Running</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-h4 font-weight-bold text-warning">{{ avgSteps.toFixed(1) }}</div>
              <div class="text-caption text-medium-emphasis">Avg Steps</div>
            </div>
          </v-col>
        </v-row>

        <!-- Charts Row -->
        <v-row>
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-2">
                Pipeline Steps Distribution
              </v-card-title>
              <v-card-text>
                <client-only>
                  <VChart
                    v-if="stepsChartOption"
                    :option="stepsChartOption"
                    autoresize
                    style="height: 200px"
                  />
                  <v-skeleton-loader v-else type="image" height="200" />
                </client-only>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-2">
                Pipeline Status Distribution
              </v-card-title>
              <v-card-text>
                <client-only>
                  <VChart
                    v-if="statusChartOption"
                    :option="statusChartOption"
                    autoresize
                    style="height: 200px"
                  />
                  <v-skeleton-loader v-else type="image" height="200" />
                </client-only>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'

// Lazy load VChart component for client-side only
const VChart = defineAsyncComponent(() =>
  import('vue-echarts').then(mod => mod.default)
)

const pipelineStore = usePipelineStore()

const pipelineStats = computed(() => {
  const pipelines = pipelineStore.allPipelines
  return {
    total: pipelines.length,
    active: pipelines.filter(p => p.status === 'active').length,
    running: pipelines.filter(p => p.status === 'running').length,
    draft: pipelines.filter(p => p.status === 'draft').length,
    completed: pipelines.filter(p => p.status === 'completed').length,
    error: pipelines.filter(p => p.status === 'error').length
  }
})

const avgSteps = computed(() => {
  if (!pipelineStore.allPipelines.length) return 0
  const total = pipelineStore.allPipelines.reduce(
    (sum: number, p: any) => sum + stepsCount(p),
    0
  )
  return total / pipelineStore.allPipelines.length
})

const stepsCount = (pipeline: any) => {
  try {
    const config = JSON.parse(pipeline.config)
    return config.steps && Array.isArray(config.steps)
      ? config.steps.length
      : 0
  } catch {
    return 0
  }
}

const stepsChartOption = computed(() => {
  if (!pipelineStore.allPipelines.length) return null

  const data = pipelineStore.allPipelines.map((p: any) => ({
    name: p.name,
    value: stepsCount(p),
  }))
  
  return {
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      data: data.map((d: { name: string; value: number }) => d.name),
      axisLabel: {
        interval: 0,
        rotate: 45,
      },
    },
    yAxis: { type: 'value' },
    series: [
      {
        data: data.map((d: { name: string; value: number }) => d.value),
        type: 'bar',
        itemStyle: { color: '#1976d2' },
      },
    ],
    grid: { left: 40, right: 20, top: 40, bottom: 80 },
  }
})

const statusChartOption = computed(() => {
  if (!pipelineStore.allPipelines.length) return null

  const statusData = [
    { value: pipelineStats.value.active, name: 'Active', itemStyle: { color: '#4caf50' } },
    { value: pipelineStats.value.running, name: 'Running', itemStyle: { color: '#2196f3' } },
    { value: pipelineStats.value.draft, name: 'Draft', itemStyle: { color: '#ff9800' } },
    { value: pipelineStats.value.completed, name: 'Completed', itemStyle: { color: '#9c27b0' } },
    { value: pipelineStats.value.error, name: 'Error', itemStyle: { color: '#f44336' } }
  ].filter(item => item.value > 0)

  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: '70%',
        data: statusData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
})
</script> 