<template>
  <v-card class="model-guide" variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon color="primary" class="mr-2">mdi-school</v-icon>
      Model Creation Guide
    </v-card-title>
    
    <v-card-text>
      <div class="text-body-2">
        <p class="mb-3"><strong>Follow these steps to create your AI model:</strong></p>
        
        <v-stepper v-model="currentStep" class="elevation-0">
          <v-stepper-header class="elevation-0">
            <template v-for="(step, index) in steps" :key="index">
              <v-stepper-item
                :value="index + 1"
                :title="step.title"
                :subtitle="step.subtitle"
                :complete="currentStep > index + 1"
              ></v-stepper-item>
              
              <v-divider v-if="index < steps.length - 1"></v-divider>
            </template>
          </v-stepper-header>

          <v-stepper-window>
            <v-stepper-window-item
              v-for="(step, index) in steps"
              :key="index"
              :value="index + 1"
            >
              <div class="pa-4">
                <h4 class="text-h6 mb-3">{{ step.title }}</h4>
                <p class="text-body-2 mb-3">{{ step.description }}</p>
                
                <v-alert
                  v-if="step.tip"
                  type="info"
                  variant="tonal"
                  class="mb-3"
                >
                  <strong>💡 Tip:</strong> {{ step.tip }}
                </v-alert>
                
                <div v-if="step.examples" class="mb-3">
                  <strong>Examples:</strong>
                  <ul class="mt-2">
                    <li v-for="example in step.examples" :key="example" class="text-body-2">
                      {{ example }}
                    </li>
                  </ul>
                </div>
              </div>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const currentStep = ref(1)

const steps = [
  {
    title: 'Choose Model Type',
    subtitle: 'Select the right model for your use case',
    description: 'Start by selecting the type of model you want to create. Consider your specific use case and requirements.',
    tip: 'For text generation, choose GPT-style models. For classification, consider BERT variants.',
    examples: [
      'Text Generation (GPT, LLaMA)',
      'Text Classification (BERT, RoBERTa)',
      'Translation (T5, Marian)',
      'Custom Fine-tuned Model'
    ]
  },
  {
    title: 'Configure Parameters',
    subtitle: 'Set model hyperparameters',
    description: 'Configure the model parameters including learning rate, batch size, epochs, and other training settings.',
    tip: 'Start with default values and adjust based on your dataset size and complexity.',
    examples: [
      'Learning Rate: 1e-4 to 1e-5',
      'Batch Size: 8-32 for most cases',
      'Epochs: 3-10 for fine-tuning',
      'Optimizer: AdamW or AdaFactor'
    ]
  },
  {
    title: 'Prepare Dataset',
    subtitle: 'Upload and format your training data',
    description: 'Upload your training dataset and ensure it\'s properly formatted for the selected model type.',
    tip: 'Ensure your data is clean, well-labeled, and representative of your use case.',
    examples: [
      'Text files (.txt, .json)',
      'CSV files with labeled data',
      'JSON format for structured data',
      'Minimum 1000 examples recommended'
    ]
  },
  {
    title: 'Start Training',
    subtitle: 'Begin model training process',
    description: 'Initiate the training process and monitor progress through the training dashboard.',
    tip: 'Training can take several hours depending on dataset size and model complexity.',
    examples: [
      'Monitor loss curves',
      'Check validation metrics',
      'Save checkpoints regularly',
      'Stop early if overfitting occurs'
    ]
  },
  {
    title: 'Evaluate & Deploy',
    subtitle: 'Test and deploy your model',
    description: 'Evaluate your trained model and deploy it for production use.',
    tip: 'Always test your model on a separate validation set before deployment.',
    examples: [
      'Run evaluation metrics',
      'Test with sample inputs',
      'Deploy to production',
      'Monitor performance'
    ]
  }
]
</script>

<style scoped>
.model-guide {
  max-width: 800px;
  margin: 0 auto;
}
</style>
