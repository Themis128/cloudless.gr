<template>
  <v-card class="bg-white">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon start color="primary">
          mdi-plus-circle
        </v-icon>
        Model Builder
      </div>
      <v-chip
        color="primary"
        variant="tonal"
        size="small"
      >
        Step {{ modelStore.builderStep + 1 }} of {{ modelStore.builderSteps.length }}
      </v-chip>
    </v-card-title>
    
    <v-card-text>
      <!-- Progress Bar -->
      <v-progress-linear
        :model-value="modelStore.builderProgress"
        color="primary"
        height="4"
        class="mb-6"
      />
      
      <!-- Step Content -->
      <div class="step-content">
        <!-- Step 0: Basic Info -->
        <div v-if="modelStore.builderStep === 0">
          <h3 class="text-h6 mb-4">Basic Information</h3>
          <v-form @submit.prevent="nextStep">
            <v-text-field
              v-model="modelStore.builderForm.name"
              label="Model Name"
              placeholder="Enter model name"
              variant="outlined"
              :error-messages="modelStore.validationErrors.name"
              @input="modelStore.updateBuilderForm('name', $event.target.value)"
              required
            />
            
            <v-textarea
              v-model="modelStore.builderForm.description"
              label="Description"
              placeholder="Describe your model's purpose and functionality"
              variant="outlined"
              :error-messages="modelStore.validationErrors.description"
              @input="modelStore.updateBuilderForm('description', $event.target.value)"
              rows="3"
              required
            />
            
            <v-select
              v-model="modelStore.builderForm.type"
              label="Model Type"
              :items="modelTypes"
              variant="outlined"
              :error-messages="modelStore.validationErrors.type"
              @update:model-value="modelStore.updateBuilderForm('type', $event)"
              required
            />
          </v-form>
        </div>
        
        <!-- Step 1: Configuration -->
        <div v-if="modelStore.builderStep === 1">
          <h3 class="text-h6 mb-4">Model Configuration</h3>
          <v-textarea
            v-model="modelStore.builderForm.config"
            label="Configuration (JSON)"
            placeholder='{"layers": [{"type": "dense", "units": 128}], "activation": "relu"}'
            variant="outlined"
            :error-messages="modelStore.validationErrors.config"
            @input="modelStore.updateBuilderForm('config', $event.target.value)"
            rows="8"
            required
          />
          <v-alert
            type="info"
            variant="tonal"
            class="mt-4"
          >
            <template #prepend>
              <v-icon>mdi-information</v-icon>
            </template>
            Enter the model architecture configuration in JSON format. This defines the layers, activation functions, and other architectural details.
          </v-alert>
        </div>
        
        <!-- Step 2: Hyperparameters -->
        <div v-if="modelStore.builderStep === 2">
          <h3 class="text-h6 mb-4">Training Hyperparameters</h3>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="modelStore.builderForm.hyperparameters.learningRate"
                label="Learning Rate"
                type="number"
                step="0.001"
                min="0.0001"
                max="1"
                variant="outlined"
                @input="updateHyperparameter('learningRate', $event.target.value)"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="modelStore.builderForm.hyperparameters.batchSize"
                label="Batch Size"
                type="number"
                min="1"
                max="512"
                variant="outlined"
                @input="updateHyperparameter('batchSize', $event.target.value)"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="modelStore.builderForm.hyperparameters.epochs"
                label="Epochs"
                type="number"
                min="1"
                max="1000"
                variant="outlined"
                @input="updateHyperparameter('epochs', $event.target.value)"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="modelStore.builderForm.hyperparameters.optimizer"
                label="Optimizer"
                :items="optimizers"
                variant="outlined"
                @update:model-value="updateHyperparameter('optimizer', $event)"
              />
            </v-col>
          </v-row>
        </div>
        
        <!-- Step 3: Review -->
        <div v-if="modelStore.builderStep === 3">
          <h3 class="text-h6 mb-4">Review Configuration</h3>
          <v-card variant="outlined" class="mb-4">
            <v-card-title>Model Summary</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-tag</v-icon>
                  </template>
                  <v-list-item-title>Name</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.name }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-text</v-icon>
                  </template>
                  <v-list-item-title>Description</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.description }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-brain</v-icon>
                  </template>
                  <v-list-item-title>Type</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.type }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-tune</v-icon>
                  </template>
                  <v-list-item-title>Learning Rate</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.hyperparameters.learningRate }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-tune</v-icon>
                  </template>
                  <v-list-item-title>Batch Size</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.hyperparameters.batchSize }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-tune</v-icon>
                  </template>
                  <v-list-item-title>Epochs</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.hyperparameters.epochs }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-tune</v-icon>
                  </template>
                  <v-list-item-title>Optimizer</v-list-item-title>
                  <v-list-item-subtitle>{{ modelStore.builderForm.hyperparameters.optimizer }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </div>
      </div>
      
      <!-- Navigation Buttons -->
      <div class="d-flex justify-space-between mt-6">
        <v-btn
          v-if="modelStore.builderStep > 0"
          variant="outlined"
          @click="modelStore.prevBuilderStep()"
        >
          <v-icon start>mdi-arrow-left</v-icon>
          Previous
        </v-btn>
        <div></div>
        
        <div class="d-flex gap-2">
          <v-btn
            v-if="modelStore.builderStep < modelStore.builderSteps.length - 1"
            color="primary"
            @click="nextStep"
            :disabled="!modelStore.canProceedToNextStep"
          >
            Next
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
          <v-btn
            v-else
            color="success"
            @click="createModel"
            :loading="modelStore.isLoading"
            :disabled="modelStore.hasValidationErrors"
          >
            <v-icon start>mdi-check</v-icon>
            Create Model
          </v-btn>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useModelStore } from '~/stores/modelStore'

const modelStore = useModelStore()

const modelTypes = [
  { title: 'Text Classification', value: 'text-classification' },
  { title: 'Image Classification', value: 'image-classification' },
  { title: 'Object Detection', value: 'object-detection' },
  { title: 'Sentiment Analysis', value: 'sentiment-analysis' },
  { title: 'Translation', value: 'translation' },
  { title: 'Summarization', value: 'summarization' },
  { title: 'Regression', value: 'regression' },
  { title: 'Clustering', value: 'clustering' }
]

const optimizers = [
  'adam',
  'sgd',
  'rmsprop',
  'adagrad',
  'adamax'
]

const nextStep = () => {
  modelStore.validateAllFields()
  if (!modelStore.hasValidationErrors) {
    modelStore.nextBuilderStep()
  }
}

const updateHyperparameter = (key: string, value: any) => {
  modelStore.updateBuilderForm('hyperparameters', { [key]: value })
}

const createModel = async () => {
  const success = await modelStore.submitBuilder()
  if (success) {
    // Navigate to models list or show success message
    navigateTo('/models')
  }
}
</script>

<style scoped>
.step-content {
  min-height: 300px;
}

.gap-2 {
  gap: 0.5rem;
}
</style> 