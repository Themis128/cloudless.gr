<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="10">
        <v-card>
          <v-card-title>Pipelines</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <div>Use the template below to create a new pipeline. Fill in the fields and click 'Create Pipeline'.</div>
              <v-code>
{
  "name": "MyPipeline",
  "config": { "steps": [] }
}
              </v-code>
            </div>
            <v-list>
              <v-list-item v-for="pipeline in pipelines" :key="pipeline.id">
                <v-list-item-content>
                  <v-list-item-title>{{ pipeline.name }}</v-list-item-title>
                  <v-list-item-subtitle>{{ pipeline.created_at }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list>
            <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'

const pipelines = ref<Database['public']['Tables']['pipelines']['Row'][]>([])
const error = ref<string | null>(null)
const supabase = useSupabase()

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
