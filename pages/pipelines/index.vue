<template>
  <PipelineGuide />
  <v-container>
    <v-btn icon class="mb-4" to="/">
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>

    <v-row align="center" justify="space-between" class="mb-4">
      <v-col cols="12" md="6">
        <v-btn color="primary" to="/pipelines/create">
          <v-icon start>mdi-plus</v-icon> Create Pipeline
        </v-btn>
      </v-col>
      <v-col cols="12" md="6" class="text-md-right text-center">
        <v-chip color="primary" class="mr-2">Total: {{ pipelines.length }}</v-chip>
        <v-chip color="info">Avg Steps: {{ avgSteps }}</v-chip>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="8" class="mx-auto mb-6" v-if="pipelines.length > 0">
        <v-card>
          <v-card-title>Pipeline Steps Distribution</v-card-title>
          <v-card-text>
            <client-only>
              <VChart v-if="chartOption" :option="chartOption" autoresize style="height: 300px;" />
              <v-skeleton-loader v-else type="image" height="300" />
            </client-only>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6" lg="4" v-for="pipeline in pipelines" :key="pipeline.id">
        <v-card>
          <v-card-title>
            {{ pipeline.name }}
            <!-- Removed pipeline.type chip: not present in schema -->
          </v-card-title>
          <v-card-subtitle>{{ formatDate(pipeline.created_at) }}</v-card-subtitle>
          <v-card-text>
            <strong>Steps:</strong> {{ stepsCount(pipeline) }}<br>
            <span v-if="pipeline.description">{{ pipeline.description }}</span>
          </v-card-text>
          <v-card-actions>
            <v-btn text :to="`/pipelines/${pipeline.id}`">View</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-alert type="info" v-if="pipelines.length === 0 && !error && !loading">
          No pipelines found. Click "Create Pipeline" to get started.
        </v-alert>
        <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
        <v-progress-linear v-if="loading" indeterminate color="primary" class="mt-3" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

// Lazy load VChart component for client-side only
const VChart = defineAsyncComponent(() => 
  import('vue-echarts').then(mod => mod.default)
)

type PipelineRow = {
  config: any;
  created_at: string | null;
  description: string | null;
  id: string;
  is_active: boolean | null;
  name: string;
  owner_id: string;
  project_id: string;
  updated_at: string | null;
  version: number | null;
};
const pipelines = ref<PipelineRow[]>([])
const error = ref<string | null>(null)
const loading = ref<boolean>(true)
const supabase = useSupabase()

const avgSteps = computed(() => {
  if (!pipelines.value.length) return 0
  const total = pipelines.value.reduce((sum: number, p: PipelineRow) => sum + stepsCount(p), 0)
  return Math.round(total / pipelines.value.length)
})

const chartOption = computed(() => {
  if (!pipelines.value.length) return null
  
  const data = pipelines.value.map((p: PipelineRow) => ({ name: p.name, value: stepsCount(p) }))
  return {
    tooltip: { trigger: 'item' },
    xAxis: { 
      type: 'category', 
      data: data.map((d: { name: string; value: number }) => d.name),
      axisLabel: {
        interval: 0,
        rotate: 45
      }
    },
    yAxis: { type: 'value' },
    series: [{
      data: data.map((d: { name: string; value: number }) => d.value),
      type: 'bar',
      itemStyle: { color: '#1976d2' },
    }],
    grid: { left: 40, right: 20, top: 40, bottom: 80 },
  }
})

function formatDate(date: string | null) {
  if (!date) return ''
  return new Date(date).toLocaleString()
}

function stepsCount(pipeline: any) {
  return (pipeline.config && pipeline.config.steps && Array.isArray(pipeline.config.steps))
    ? pipeline.config.steps.length
    : 0
}

onMounted(async () => {
  loading.value = true
  const { data, error: err } = await supabase
    .from('pipelines')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  if (err) {
    error.value = err.message
  } else {
    pipelines.value = data ?? []
  }
  loading.value = false
})
</script>
