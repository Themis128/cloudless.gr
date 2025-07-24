<template>
  <v-card class="bg-white">
    <v-card-title class="d-flex align-center">
      <v-icon start color="primary">
        mdi-play-circle
      </v-icon>
      Model Tester
    </v-card-title>
    
    <v-card-text>
      <!-- Test Input -->
      <v-form @submit.prevent="testModel">
        <v-textarea
          v-model="modelStore.testInput"
          label="Test Input"
          placeholder="Enter text to test your model..."
          variant="outlined"
          rows="4"
          @input="modelStore.updateTestInput($event.target.value)"
        />
        
        <div class="d-flex justify-end mt-4">
          <v-btn
            color="primary"
            @click="testModel"
            :loading="modelStore.testLoading"
            :disabled="!modelStore.testInput.trim()"
          >
            <v-icon start>mdi-play</v-icon>
            Test Model
          </v-btn>
        </div>
      </v-form>
      
      <!-- Test Results -->
      <div v-if="modelStore.hasTestResults" class="mt-6">
        <h3 class="text-h6 mb-4">Test Results</h3>
        
        <v-list>
          <v-list-item
            v-for="result in modelStore.testResults"
            :key="result.id"
            class="mb-3"
            rounded="lg"
            variant="outlined"
          >
            <template #prepend>
              <v-avatar color="primary" size="40">
                <v-icon color="white">mdi-test-tube</v-icon>
              </v-avatar>
            </template>
            
            <v-list-item-title class="text-h6">
              Test Result
            </v-list-item-title>
            
            <v-list-item-subtitle class="mt-2">
              <div class="mb-2">
                <strong>Input:</strong> {{ result.input }}
              </div>
              <div class="mb-2">
                <strong>Output:</strong> {{ result.output }}
              </div>
              <div class="d-flex gap-4">
                <span class="d-flex align-center">
                  <v-icon size="16" class="mr-1">mdi-chart-line</v-icon>
                  Confidence: {{ (result.confidence * 100).toFixed(1) }}%
                </span>
                <span class="d-flex align-center">
                  <v-icon size="16" class="mr-1">mdi-clock</v-icon>
                  {{ result.processingTime }}ms
                </span>
                <span class="d-flex align-center">
                  <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                  {{ formatDate(result.timestamp) }}
                </span>
              </div>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        
        <div class="d-flex justify-end mt-4">
          <v-btn
            variant="outlined"
            @click="modelStore.resetTest()"
          >
            <v-icon start>mdi-refresh</v-icon>
            Clear Results
          </v-btn>
        </div>
      </div>
      
      <!-- No Results State -->
      <div v-else class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1" class="mb-4">
          mdi-test-tube
        </v-icon>
        <h3 class="text-h6 mb-2">
          No test results yet
        </h3>
        <p class="text-body-2 text-medium-emphasis">
          Enter some input above and click "Test Model" to see results.
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useModelStore } from '~/stores/modelStore'

const props = defineProps<{
  modelId: number
}>()

const modelStore = useModelStore()

const testModel = async () => {
  if (modelStore.testInput.trim()) {
    await modelStore.testModel(props.modelId, modelStore.testInput)
  }
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleString()
}
</script>

<style scoped>
.gap-4 {
  gap: 1rem;
}
</style> 