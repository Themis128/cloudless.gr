<template>
  <v-card class="ma-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-cog</v-icon>
      Training Configuration
    </v-card-title>
    
    <v-card-text>
      <v-form ref="form" v-model="valid" @submit.prevent="handleSubmit">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="config.model_name"
              label="Model Name"
              :rules="[rules.required]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-select
              v-model="config.model_type"
              :items="modelTypes"
              label="Model Type"
              :rules="[rules.required]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.epochs"
              label="Epochs"
              type="number"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.batch_size"
              label="Batch Size"
              type="number"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.learning_rate"
              label="Learning Rate"
              type="number"
              step="0.001"
              :rules="[rules.required, rules.positive]"
              required
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-select
              v-model="config.optimizer"
              :items="optimizers"
              label="Optimizer"
              :rules="[rules.required]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="config.loss_function"
              :items="lossFunctions"
              label="Loss Function"
              :rules="[rules.required]"
              required
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="config.notes"
              label="Training Notes"
              rows="3"
              placeholder="Optional notes about this training configuration..."
            />
          </v-col>
        </v-row>
        
        <v-row>
          <v-col cols="12">
            <v-switch
              v-model="config.early_stopping"
              label="Enable Early Stopping"
              color="primary"
            />
          </v-col>
        </v-row>
        
        <v-row v-if="config.early_stopping">
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.patience"
              label="Early Stopping Patience"
              type="number"
              :rules="[rules.positive]"
            />
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="config.min_delta"
              label="Minimum Delta"
              type="number"
              step="0.001"
              :rules="[rules.positive]"
            />
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>
    
    <v-card-actions>
      <v-spacer />
      <v-btn 
        variant="outlined" 
        @click="resetForm"
      >
        Reset
      </v-btn>
      <v-btn 
        color="primary" 
        :disabled="!valid || loading"
        :loading="loading"
        @click="handleSubmit"
      >
        Start Training
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

interface TrainingConfig {
  model_name: string
  model_type: string
  epochs: number
  batch_size: number
  learning_rate: number
  optimizer: string
  loss_function: string
  notes: string
  early_stopping: boolean
  patience?: number
  min_delta?: number
}

const props = defineProps<{
  projectId: string
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [config: TrainingConfig]
}>()

const form = ref()
const valid = ref(false)

const config = reactive<TrainingConfig>({
  model_name: '',
  model_type: '',
  epochs: 100,
  batch_size: 32,
  learning_rate: 0.001,
  optimizer: 'adam',
  loss_function: '',
  notes: '',
  early_stopping: false,
  patience: 10,
  min_delta: 0.001
})

const modelTypes = [
  { title: 'Classification', value: 'classification' },
  { title: 'Regression', value: 'regression' },
  { title: 'Neural Network', value: 'neural_network' },
  { title: 'Random Forest', value: 'random_forest' },
  { title: 'SVM', value: 'svm' },
  { title: 'XGBoost', value: 'xgboost' },
  { title: 'LSTM', value: 'lstm' },
  { title: 'CNN', value: 'cnn' },
  { title: 'Transformer', value: 'transformer' }
]

const optimizers = [
  { title: 'Adam', value: 'adam' },
  { title: 'SGD', value: 'sgd' },
  { title: 'RMSprop', value: 'rmsprop' },
  { title: 'AdaGrad', value: 'adagrad' },
  { title: 'Adadelta', value: 'adadelta' }
]

const lossFunctions = [
  { title: 'Mean Squared Error', value: 'mse' },
  { title: 'Binary Crossentropy', value: 'binary_crossentropy' },
  { title: 'Categorical Crossentropy', value: 'categorical_crossentropy' },
  { title: 'Sparse Categorical Crossentropy', value: 'sparse_categorical_crossentropy' },
  { title: 'Mean Absolute Error', value: 'mae' },
  { title: 'Huber Loss', value: 'huber' },
  { title: 'Hinge Loss', value: 'hinge' }
]

const rules = {
  required: (value: any) => !!value || 'This field is required',
  positive: (value: number) => value > 0 || 'Must be greater than 0'
}

function handleSubmit() {
  if (valid.value) {
    emit('submit', { ...config })
  }
}

function resetForm() {
  Object.assign(config, {
    model_name: '',
    model_type: '',
    epochs: 100,
    batch_size: 32,
    learning_rate: 0.001,
    optimizer: 'adam',
    loss_function: '',
    notes: '',
    early_stopping: false,
    patience: 10,
    min_delta: 0.001
  })
  form.value?.resetValidation()
}
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  background: linear-gradient(45deg, #1976d2, #42a5f5);
  color: white;
  border-radius: 12px 12px 0 0;
}
</style>
