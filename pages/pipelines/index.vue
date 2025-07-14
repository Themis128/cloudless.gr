<template>
  <v-container>
    <v-btn color="primary" class="mb-4" to="/pipelines/create">
      <v-icon start>mdi-plus</v-icon> Create Pipeline
    </v-btn>
    <v-row>
      <v-col cols="12" md="6" lg="4" v-for="pipeline in pipelines" :key="pipeline.id">
        <v-card>
          <v-card-title>
            {{ pipeline.name }}
            <!-- <v-chip color="info" small v-if="pipeline.type" class="ml-2">{{ pipeline.type }}</v-chip> -->
          </v-card-title>
          <v-card-subtitle>{{ formatDate(pipeline.created_at) }}</v-card-subtitle>
          <v-card-text>
            Steps: {{ stepsCount(pipeline) }}
          </v-card-text>
          <v-card-actions>
            <v-btn text :to="`/pipelines/${pipeline.id}`">View</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    <v-alert type="info" v-if="pipelines.length === 0 && !error">
      No pipelines found. Click "Create Pipeline" to get started.
    </v-alert>
    <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'

const pipelines = ref<Database['public']['Tables']['pipelines']['Row'][]>([])
const error = ref<string | null>(null)
const supabase = useSupabase()

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
})
</script>
