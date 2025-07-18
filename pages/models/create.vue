<template>
  <div>
    <BackButton :to="`/models`" />
    <ModelGuide />
    <v-card>
      <v-card-title>Create Model</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submit">
          <v-text-field
            v-model="form.name"
            label="Model Name"
            required
          />
          <v-select
            v-model="form.type"
            :items="modelTypes"
            label="Model Type"
            required
          />
          <v-textarea
            v-model="form.description"
            label="Description"
            rows="3"
          />
          <v-btn
            type="submit"
            color="primary"
            :loading="loading"
          >
            Create Model
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BackButton from '~/components/ui/BackButton.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

const loading = ref(false)
const form = ref({
  name: '',
  type: '',
  description: ''
})

const modelTypes = [
  'Classification',
  'Regression',
  'Neural Network',
  'Transformer',
  'Custom'
]

async function submit() {
  loading.value = true
  // Add your submission logic here
  loading.value = false
}
</script>
