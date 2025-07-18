<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8" class="mx-auto">
        <v-card>
          <v-card-title>Pipeline Details</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="savePipelineDetails">
              <v-text-field
                v-model="form.name"
                label="Pipeline Name"
                :rules="[v => !!v || 'Name is required']"
                required
                class="mb-4"
              />
              
              <v-textarea
                v-model="form.description"
                label="Description"
                hint="Describe what this pipeline does"
                class="mb-4"
              />

              <v-select
                v-model="form.type"
                :items="pipelineTypes"
                label="Pipeline Type"
                item-title="label"
                item-value="value"
                class="mb-4"
              />

              <v-switch
                v-model="form.isActive"
                label="Active"
                color="primary"
                class="mb-4"
              />

              <v-card-actions>
                <v-spacer />
                <v-btn
                  color="primary"
                  :loading="loading"
                  :disabled="!isValid"
                  @click="savePipelineDetails"
                >
                  Continue
                </v-btn>
              </v-card-actions>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)

const form = ref({
  name: '',
  description: '',
  type: 'processing',
  isActive: true
})

const pipelineTypes = [
  { label: 'Data Processing', value: 'processing' },
  { label: 'Model Training', value: 'training' },
  { label: 'Inference', value: 'inference' },
  { label: 'ETL', value: 'etl' }
]

const isValid = computed(() => {
  return form.value.name.length > 0
})

async function savePipelineDetails() {
  if (!isValid.value) return
  
  loading.value = true
  try {
    // Save to store or local storage for now
    localStorage.setItem('pipelineDetails', JSON.stringify(form.value))
    // Navigate to next step
    router.push('/pipelines/create/model-selection')
  } catch (error) {
    console.error('Error saving pipeline details:', error)
  } finally {
    loading.value = false
  }
}
</script> 