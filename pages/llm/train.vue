<template>
  <v-container>
    <div class="d-flex align-center mb-6">
      <BackButton to="/llm" />
      <div class="ml-4">
        <h1 class="text-h4 mb-2">
          Train LLM Model
        </h1>
        <p class="text-body-1 text-medium-emphasis">
          Create and train a new language model with your custom data
        </p>
      </div>
    </div>

    <v-row>
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-icon start color="primary">
              mdi-school
            </v-icon>
            Training Configuration
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-form ref="formRef" @submit.prevent="startTraining">
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="form.name"
                    label="Training Job Name"
                    :rules="[rules.required, rules.minLength(3)]"
                    placeholder="e.g., Customer Support Model v1.0"
                    required
                    clearable
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.baseModel"
                    :items="baseModels"
                    label="Base Model"
                    :rules="[rules.required]"
                    item-title="name"
                    item-value="id"
                    required
                  >
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon>{{ item.raw.icon }}</v-icon>
                        </template>
                        <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                        <v-list-item-subtitle>{{ item.raw.description }}</v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>
                </v-col>

                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.trainingType"
                    :items="trainingTypes"
                    label="Training Type"
                    :rules="[rules.required]"
                    item-title="title"
                    item-value="value"
                    required
                  >
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props">
                        <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                        <v-list-item-subtitle>{{ item.raw.description }}</v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>
                </v-col>

                <v-col cols="12">
                  <v-file-input
                    v-model="form.trainingData"
                    label="Training Data"
                    :rules="[rules.required, rules.fileSize, rules.fileType]"
                    accept=".csv,.json,.txt,.jsonl"
                    show-size
                    prepend-icon="mdi-file-upload"
                    required
                    clearable
                  >
                    <template #selection="{ fileNames }">
                      <template v-for="fileName in fileNames" :key="fileName">
                        <v-chip
                          color="primary"
                          size="small"
                          class="me-2"
                        >
                          {{ fileName }}
                        </v-chip>
                      </template>
                    </template>
                  </v-file-input>
                  <v-alert
                    v-if="form.trainingData && form.trainingData.length > 0"
                    type="info"
                    variant="tonal"
                    class="mt-2"
                  >
                    <strong>File Info:</strong> {{ formatFileSize(form.trainingData[0].size) }} - 
                    {{ form.trainingData[0].type || 'Unknown type' }}
                  </v-alert>
                </v-col>

                <v-col cols="12">
                  <v-textarea
                    v-model="form.description"
                    label="Description (Optional)"
                    rows="3"
                    placeholder="Describe the purpose and expected outcomes of this training..."
                    clearable
                  />
                </v-col>
              </v-row>

              <!-- Advanced Settings -->
              <v-expansion-panels class="mt-4">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start>
                      mdi-cog
                    </v-icon>
                    Advanced Training Parameters
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-row>
                      <v-col cols="12" md="4">
                        <v-text-field
                          v-model.number="form.parameters.epochs"
                          label="Epochs"
                          type="number"
                          :rules="[rules.positiveNumber]"
                          min="1"
                          max="100"
                          hint="Number of training iterations"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="12" md="4">
                        <v-text-field
                          v-model.number="form.parameters.batchSize"
                          label="Batch Size"
                          type="number"
                          :rules="[rules.positiveNumber]"
                          min="1"
                          max="128"
                          hint="Training batch size"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="12" md="4">
                        <v-text-field
                          v-model.number="form.parameters.learningRate"
                          label="Learning Rate"
                          type="number"
                          :rules="[rules.positiveNumber]"
                          min="0.0001"
                          max="0.1"
                          step="0.0001"
                          hint="Model learning rate"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="12">
                        <v-switch
                          v-model="form.parameters.useEarlyStop"
                          label="Early Stopping"
                          color="primary"
                          hint="Stop training when model performance plateaus"
                          persistent-hint
                        />
                      </v-col>
                    </v-row>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-card-actions class="px-0 pt-6">
                <v-spacer />
                <v-btn
                  variant="outlined"
                  :disabled="loading"
                  @click="navigateBack"
                >
                  Cancel
                </v-btn>
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="loading"
                  :disabled="!isFormValid"
                >
                  <v-icon start>
                    mdi-play
                  </v-icon>
                  Start Training
                </v-btn>
              </v-card-actions>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <!-- Training Tips -->
        <v-card class="mb-4">
          <v-card-title>
            <v-icon start color="info">
              mdi-lightbulb
            </v-icon>
            Training Tips
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <template #prepend>
                  <v-icon color="success" size="small">
                    mdi-check
                  </v-icon>
                </template>
                <v-list-item-title class="text-body-2">
                  Use high-quality, diverse training data
                </v-list-item-title>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="success" size="small">
                    mdi-check
                  </v-icon>
                </template>
                <v-list-item-title class="text-body-2">
                  Start with smaller datasets for testing
                </v-list-item-title>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="success" size="small">
                    mdi-check
                  </v-icon>
                </template>
                <v-list-item-title class="text-body-2">
                  Monitor training progress regularly
                </v-list-item-title>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="success" size="small">
                    mdi-check
                  </v-icon>
                </template>
                <v-list-item-title class="text-body-2">
                  Use early stopping to prevent overfitting
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Data Format Guide -->
        <v-card>
          <v-card-title>
            <v-icon start color="warning">
              mdi-file-document
            </v-icon>
            Data Format Guide
          </v-card-title>
          <v-card-text>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title>JSON Lines (.jsonl)</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre class="text-caption">{"input": "Question?", "output": "Answer"}</pre>
                  <p class="text-caption mt-2">
                    Best for Q&A and conversational training
                  </p>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title>CSV (.csv)</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre class="text-caption">input,output
"Question?","Answer"</pre>
                  <p class="text-caption mt-2">
                    Simple tabular format
                  </p>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title>Plain Text (.txt)</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-caption">
                    Raw text for language modeling
                  </p>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Training Progress Dialog -->
    <v-dialog
      v-model="trainingDialog"
      max-width="600"
      persistent
    >
      <v-card>
        <v-card-title>
          <v-icon start color="primary">
            mdi-cog
          </v-icon>
          Training in Progress
        </v-card-title>
        <v-card-text>
          <div class="text-center mb-4">
            <v-progress-circular
              :model-value="trainingProgress"
              :size="100"
              :width="8"
              color="primary"
            >
              {{ Math.round(trainingProgress) }}%
            </v-progress-circular>
          </div>
          
          <v-list>
            <v-list-item>
              <v-list-item-title>Training Job</v-list-item-title>
              <v-list-item-subtitle>{{ currentTrainingJob?.name }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Current Epoch</v-list-item-title>
              <v-list-item-subtitle>{{ currentEpoch }} / {{ totalEpochs }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip color="primary" size="small">
                  {{ trainingStatus }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-progress-linear
            :model-value="trainingProgress"
            height="8"
            color="primary"
            class="mt-4"
          />

          <v-alert
            v-if="trainingLogs.length > 0"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            <strong>Latest:</strong> {{ trainingLogs[trainingLogs.length - 1] }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="warning"
            variant="outlined"
            :disabled="trainingStatus === 'stopping'"
            @click="stopTraining"
          >
            Stop Training
          </v-btn>
          <v-btn
            v-if="trainingStatus === 'completed'"
            color="primary"
            @click="closeTrainingDialog"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success/Error Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="5000"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="closeSnackbar">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BackButton from '~/components/ui/BackButton.vue'
import { useSupabase } from '~/composables/supabase'

// Composables
const router = useRouter()
const supabase = useSupabase()
// const trainingStore = useTrainingStore()

// Form reference
const formRef = ref<any>(null)

// Reactive state
const loading = ref(false)
const trainingDialog = ref(false)
const trainingProgress = ref(0)
const currentEpoch = ref(0)
const totalEpochs = ref(10)
const trainingStatus = ref('initializing')
const trainingLogs = ref<string[]>([])
const currentTrainingJob = ref<any>(null)

// Training progress interval
let progressInterval: NodeJS.Timeout | null = null

const form = ref({
  name: '',
  baseModel: '',
  trainingType: 'fine-tuning',
  trainingData: [] as File[],
  description: '',
  parameters: {
    epochs: 10,
    batchSize: 16,
    learningRate: 0.001,
    useEarlyStop: true
  }
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// Form validation rules
const rules = {
  required: (value: any) => !!value || 'This field is required',
  minLength: (min: number) => (value: string) => 
    (value && value.length >= min) || `Must be at least ${min} characters`,
  positiveNumber: (value: number) => value > 0 || 'Must be a positive number',
  fileSize: (files: File[]) => {
    if (!files || files.length === 0) return true
    const maxSize = 100 * 1024 * 1024 // 100MB
    return files[0].size <= maxSize || 'File size must be less than 100MB'
  },
  fileType: (files: File[]) => {
    if (!files || files.length === 0) return true
    const allowedTypes = ['.csv', '.json', '.txt', '.jsonl']
    const fileName = files[0].name.toLowerCase()
    return allowedTypes.some(type => fileName.endsWith(type)) || 
           'File must be CSV, JSON, TXT, or JSONL format'
  }
}

// Base models available for training
const baseModels = [
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and efficient for most tasks',
    icon: 'mdi-flash'
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'Most capable model for complex tasks',
    icon: 'mdi-star'
  },
  {
    id: 'llama-2-7b',
    name: 'Llama 2 7B',
    description: 'Open-source model, good for customization',
    icon: 'mdi-open-source-initiative'
  },
  {
    id: 'custom',
    name: 'Custom Model',
    description: 'Use your own base model',
    icon: 'mdi-cog'
  }
]

// Training types
const trainingTypes = [
  {
    title: 'Fine-tuning',
    value: 'fine-tuning',
    description: 'Adapt existing model to specific tasks'
  },
  {
    title: 'Full Training',
    value: 'full-training',
    description: 'Train model from scratch (requires large dataset)'
  },
  {
    title: 'LoRA',
    value: 'lora',
    description: 'Low-rank adaptation for efficient fine-tuning'
  }
]

// Computed properties
const isFormValid = computed(() => {
  return form.value.name && 
         form.value.baseModel && 
         form.value.trainingType &&
         form.value.trainingData.length > 0
})

// Methods
const startTraining = async () => {
  if (!formRef.value) return
  
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  
  try {
    // Create training session record
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const trainingSession = {
      name: form.value.name,
      base_model: form.value.baseModel,
      training_type: form.value.trainingType,
      description: form.value.description,
      parameters: form.value.parameters,
      status: 'pending',
      owner_id: userId,
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('training_sessions')
      .insert([trainingSession])
      .select()
      .single()

    if (error) throw error

    currentTrainingJob.value = data
    totalEpochs.value = form.value.parameters.epochs

    // Start training progress simulation
    startTrainingProgress()
    
    // Show training dialog
    trainingDialog.value = true
    
    showSnackbar('Training started successfully!', 'success')
    
  } catch (error) {
    // console.error('Error starting training:', error)
    showSnackbar('Error starting training. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

const startTrainingProgress = () => {
  trainingProgress.value = 0
  currentEpoch.value = 0
  trainingStatus.value = 'initializing'
  trainingLogs.value = []

  // Simulate training progress
  progressInterval = setInterval(() => {
    if (trainingProgress.value < 100) {
      trainingProgress.value += Math.random() * 5
      
      if (trainingProgress.value >= 100) {
        trainingProgress.value = 100
        trainingStatus.value = 'completed'
        currentEpoch.value = totalEpochs.value
        trainingLogs.value.push('Training completed successfully!')
        clearInterval(progressInterval!)
        
        // Update database
        updateTrainingStatus('completed')
      } else {
        currentEpoch.value = Math.floor((trainingProgress.value / 100) * totalEpochs.value)
        trainingStatus.value = 'running'
        
        // Add random training logs
        const logs = [
          `Epoch ${currentEpoch.value}: Loss decreasing`,
          `Validation accuracy improved`,
          `Learning rate adjusted`,
          `Checkpoint saved`
        ]
        
        if (Math.random() > 0.7) {
          trainingLogs.value.push(logs[Math.floor(Math.random() * logs.length)])
        }
      }
    }
  }, 1000)
}

const stopTraining = async () => {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  
  trainingStatus.value = 'stopping'
  
  setTimeout(() => {
    trainingStatus.value = 'stopped'
    trainingLogs.value.push('Training stopped by user')
    updateTrainingStatus('stopped')
  }, 2000)
}

const updateTrainingStatus = async (status: string) => {
  if (!currentTrainingJob.value) return
  
  try {
    await supabase
      .from('training_sessions')
      .update({ 
        status,
        progress: trainingProgress.value,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentTrainingJob.value.id)
  } catch (error) {
    // console.error('Error updating training status:', error)
  }
}

const closeTrainingDialog = () => {
  trainingDialog.value = false
  router.push('/llm')
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}

const navigateBack = () => {
  router.push('/llm')
}

const closeSnackbar = () => {
  snackbar.value.show = false
}

// Cleanup on unmount
onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval)
  }
})
</script>

<style scoped>
.v-expansion-panels {
  box-shadow: none;
}

.v-expansion-panel {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

pre {
  background: rgba(var(--v-theme-surface-variant), 0.1);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
