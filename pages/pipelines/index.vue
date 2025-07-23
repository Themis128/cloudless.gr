<template>
  <div>
    <PageStructure
      title="Pipelines"
      subtitle="Create and manage your AI processing pipelines"
      back-button-to="/"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Quick Actions -->
        <v-card class="mb-4 bg-white">
          <v-card-title class="text-h6">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <p class="text-body-2 text-medium-emphasis">
                  Create, test, or manage pipelines
                </p>
              </div>
              <div class="quick-actions-stats">
                <client-only>
                  <v-chip color="primary" class="mr-2">
                    Total: {{ pipelines.length }}
                  </v-chip>
                  <v-chip color="info">
                    Avg Steps: {{ avgSteps }}
                  </v-chip>
                </client-only>
              </div>
            </div>
            <div class="quick-actions-buttons">
              <v-btn
                to="/pipelines/create"
                color="primary"
                prepend-icon="mdi-plus"
                variant="elevated"
                class="action-btn"
                size="large"
              >
                Create Pipeline
              </v-btn>
              <v-btn
                to="/pipelines/test"
                color="info"
                prepend-icon="mdi-play-circle"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Test Pipeline
              </v-btn>
              <v-btn
                to="/pipelines/manage"
                color="secondary"
                prepend-icon="mdi-pipe"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Manage Pipelines
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <client-only>
          <v-row>
            <v-col
              v-if="pipelines.length > 0"
              cols="12"
              class="mb-6"
            >
              <v-card class="mb-4 bg-white">
                <v-card-title class="text-h6">
                  <v-icon start color="primary">
                    mdi-chart-bar
                  </v-icon>
                  Pipeline Steps Distribution
                </v-card-title>
                <v-card-text>
                  <client-only>
                    <VChart
                      v-if="chartOption"
                      :option="chartOption"
                      autoresize
                      style="height: 300px"
                    />
                    <v-skeleton-loader v-else type="image" height="300" />
                  </client-only>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </client-only>

        <client-only>
          <v-row>
            <v-col
              v-for="pipeline in pipelines"
              :key="pipeline.id"
              cols="12"
              md="6"
              lg="4"
            >
              <v-card class="pipeline-card bg-white" elevation="2" hover>
                <v-card-title class="text-h6">
                  {{ pipeline.name }}
                </v-card-title>
                <v-card-subtitle>
                  {{
                    formatDate(pipeline.createdAt)
                  }}
                </v-card-subtitle>
                <v-card-text>
                  <strong>Steps:</strong> {{ stepsCount(pipeline) }}<br>
                  <span v-if="pipeline.description">{{
                    pipeline.description
                  }}</span>
                </v-card-text>
                <v-card-actions>
                  <v-btn text :to="`/pipelines/${pipeline.id}`">
                    View
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>

          <client-only>
            <v-row>
              <v-col cols="12">
                <v-alert
                  v-if="pipelines.length === 0 && !error && !loading"
                  type="info"
                >
                  No pipelines found. Click "Create Pipeline" to get started.
                </v-alert>
                <v-alert v-if="error" type="error" class="mt-3">
                  {{ error }}
                </v-alert>
                <v-progress-linear
                  v-if="loading"
                  indeterminate
                  color="primary"
                  class="mt-3"
                />
              </v-col>
            </v-row>
          </client-only>
        </client-only>
      </template>

      <template #sidebar>
        <PipelineGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

// Lazy load VChart component for client-side only
const VChart = defineAsyncComponent(() =>
  import('vue-echarts').then(mod => mod.default)
)

interface Pipeline {
  id: number
  name: string
  description?: string
  config: string
  status: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    name: string
    email: string
  }
}

const pipelines = ref<Pipeline[]>([])
const error = ref<string | null>(null)
const loading = ref<boolean>(true)

// Fetch pipelines from database
const fetchPipelines = async () => {
  try {
    loading.value = true
    error.value = null
    
    interface ApiResponse {
      success: boolean
      data: Pipeline[]
      message?: string
    }
    
    const response = await $fetch<ApiResponse>('/api/prisma/pipelines')
    if (response.success) {
      pipelines.value = response.data || []
    } else {
      error.value = response.message || 'Failed to fetch pipelines'
    }
  } catch (err: any) {
    console.error('Error fetching pipelines:', err)
    error.value = err.message || 'Failed to load pipelines'
  } finally {
    loading.value = false
  }
}

const avgSteps = computed(() => {
  if (!pipelines.value.length) return 0
  const total = pipelines.value.reduce(
    (sum: number, p: Pipeline) => sum + stepsCount(p),
    0
  )
  return Math.round(total / pipelines.value.length)
})

const chartOption = computed(() => {
  if (!pipelines.value.length) return null

  const data = pipelines.value.map((p: Pipeline) => ({
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

const formatDate = (date: Date) => {
  return new Date(date).toLocaleString()
}

const stepsCount = (pipeline: Pipeline) => {
  try {
    const config = JSON.parse(pipeline.config)
    return config.steps && Array.isArray(config.steps)
      ? config.steps.length
      : 0
  } catch {
    return 0
  }
}

onMounted(() => {
  fetchPipelines()
})
</script>

<style scoped>
.quick-actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.quick-actions-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

.action-btn {
  min-height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pipeline-card {
  transition: transform 0.2s ease-in-out;
  cursor: pointer;
}

.pipeline-card:hover {
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .quick-actions-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .quick-actions-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
