<template>
  <ModelGuide />
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="10">
        <v-card>
          <v-card-title>Models</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <div>Below is a template for using a model. Select a model and use it for inference or other tasks.</div>
              <v-code>
{
  "model_id": "uuid-of-model",
  "input": "Your input data here"
}
              </v-code>
            </div>
            <v-list>
              <v-list-item v-for="model in models" :key="model.id">
                <v-list-item-title>{{ model.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ model.created_at }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-btn icon class="mb-4" to="/">
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

const models = ref<Database['public']['Tables']['models']['Row'][]>([])
const error = ref<string | null>(null)
const supabase = useSupabase()

onMounted(async () => {
  const { data, error: err } = await supabase
    .from('models')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  if (err) {
    error.value = err.message
  } else {
    models.value = data ?? []
  }
})
</script>
