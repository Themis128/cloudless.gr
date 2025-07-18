<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn icon class="mb-4" to="/pipelines">
          <v-icon>mdi-arrow-left</v-icon>
        </v-btn>

        <h1 class="text-h4 mb-6">Create Pipeline</h1>

        <!-- Stepper -->
        <v-stepper v-model="currentStep" class="mb-6">
          <v-stepper-header>
            <v-stepper-item
              v-for="(step, i) in steps"
              :key="i"
              :value="i + 1"
              :complete="currentStep > i + 1"
            >
              {{ step.title }}
              <template #subtitle>
                {{ step.subtitle }}
              </template>
            </v-stepper-item>
          </v-stepper-header>
        </v-stepper>

        <!-- Router View for Steps -->
        <router-view />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const steps = [
  {
    title: 'Pipeline Details',
    subtitle: 'Set basic pipeline information',
    path: '/pipelines/create/details'
  },
  {
    title: 'Model Selection',
    subtitle: 'Choose models for your pipeline',
    path: '/pipelines/create/model-selection'
  },
  {
    title: 'Pipeline Config',
    subtitle: 'Configure pipeline steps and logic',
    path: '/pipelines/create/config'
  },
  {
    title: 'Review',
    subtitle: 'Review and validate pipeline',
    path: '/pipelines/create/review'
  }
]

// Compute current step based on route
const currentStep = ref(1)
const currentPath = route.path
const stepIndex = steps.findIndex(step => step.path === currentPath)
if (stepIndex !== -1) {
  currentStep.value = stepIndex + 1
}
</script>
