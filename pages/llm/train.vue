<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title>Train LLM or ML Model</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <div>Use the template below to start a new training session. Fill in the fields and click 'Start Training'.</div>
              <v-code>
{
  "name": "MyModelName",
  "config": {
    "dataUrl": "https://example.com/data.csv"
  }
}
              </v-code>
            </div>
            <v-form @submit.prevent="trainLLM" ref="formRef">
              <v-text-field
                v-model="modelName"
                label="Model Name"
                placeholder="e.g. MyModelName"
                required
                class="mb-3"
              />
              <v-text-field
                v-model="dataUrl"
                label="Training Data URL"
                placeholder="https://example.com/data.csv"
                required
                class="mb-3"
              />
              <v-btn type="submit" color="primary" :loading="loading">Start Training</v-btn>
            </v-form>
            <v-alert v-if="success" type="success" class="mt-3">Training started!</v-alert>
            <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTrainingStore } from '~/stores/modelStore'
import { storeToRefs } from 'pinia'

const formRef = ref()
const trainingStore = useTrainingStore()
const { modelName, dataUrl, loading, success, error } = storeToRefs(trainingStore)

function trainLLM() {
  trainingStore.train({ name: modelName.value, config: { dataUrl: dataUrl.value } })
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
