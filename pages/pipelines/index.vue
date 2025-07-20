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
                    formatDate(pipeline.created_at)
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
import { useSupabase } from '~/composables/supabase'

// Lazy load VChart component for client-side only
const VChart = defineAsyncComponent(() =>
  import('vue-echarts').then(mod => mod.default)
)

type PipelineRow = {
  config: any
  created_at: string | null
  description: string | null
  id: string
  is_active: boolean | null
  name: string
  owner_id: string
  project_id: string
  updated_at: string | null
  version: number | null
}
const pipelines = ref<PipelineRow[]>([])
const error = ref<string | null>(null)
const loading = ref<boolean>(true)

// Ensure consistent hydration by using process.client check
const isClient = process.client
const supabase = useSupabase()

const avgSteps = computed(() => {
  if (!pipelines.value.length) return 0
  const total = pipelines.value.reduce(
    (sum: number, p: PipelineRow) => sum + stepsCount(p),
    0
  )
  return Math.round(total / pipelines.value.length)
})

const chartOption = computed(() => {
  if (!pipelines.value.length) return null

  const data = pipelines.value.map((p: PipelineRow) => ({
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

const formatDate = (date: string | null) => {
  if (!date) return ''
  return new Date(date).toLocaleString()
}

const stepsCount = (pipeline: any) => {
  return pipeline.config &&
    pipeline.config.steps &&
    Array.isArray(pipeline.config.steps)
    ? pipeline.config.steps.length
    : 0
}

onMounted(async () => {
  if (isClient) {
    loading.value = true
    const { data, error: err } = await supabase
      .from('pipelines')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      error.value = err.message
    } else {
      pipelines.value = data || []
    }
    loading.value = false
  }
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
