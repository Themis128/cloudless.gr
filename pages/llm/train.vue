<template>
  <v-container>
    <h1 class="mb-4">Train LLM</h1>

    <v-form @submit.prevent="startTraining">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field v-model="form.name" label="Model Name" />
          <v-select
            v-model="form.baseModel"
            :items="['gpt-3.5', 'gpt-4', 'mistral-7b']"
            label="Base Model"
          />
          <v-select
            v-model="form.dataset"
            :items="['qa_english.csv', 'faq_docs.json', 'support_tickets.csv']"
            label="Training Dataset"
          />
          <v-text-field v-model.number="form.epochs" type="number" label="Epochs" />
          <v-text-field v-model.number="form.learningRate" type="number" label="Learning Rate" />
          <v-btn color="primary" type="submit" :loading="loading">Start Training</v-btn>
        </v-col>

        <!-- Live Config Preview -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>Preview Config</v-card-title>
            <v-card-text>
              <pre>{{ JSON.stringify(form, null, 2) }}</pre>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-form>

    <v-alert type="info" class="mt-3">
      Est. Duration: ~{{ estimatedDuration }} mins
    </v-alert>
    <v-alert type="success" v-if="success" class="mt-4">Training started!</v-alert>
    <v-alert type="error" v-if="error" class="mt-4">{{ error }}</v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const form = ref({
  name: '',
  baseModel: '',
  epochs: 3,
  learningRate: 0.001,
  dataset: '',
})

const estimatedDuration = computed(() => (form.value.epochs * 2.5).toFixed(1))

async function startTraining() {
  loading.value = true
  error.value = null
  success.value = false

  const { error: err } = await supabase.from('models').insert({
    ...form.value,
    status: 'training',
    created_at: new Date().toISOString(),
  })

  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = true
    form.value = {
      name: '',
      baseModel: '',
      epochs: 3,
      learningRate: 0.001,
      dataset: '',
    }
  }
}
</script>

<style scoped>
.mb-3 {
  margin-bottom: 1rem;
}
.mt-3 {
  margin-top: 1rem;
}
</style>
