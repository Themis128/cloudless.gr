<template>
  <div>
    <PageStructure
      title="Train LLM Model"
      subtitle="Create and train a new language model with your custom data"
      back-button-to="/llm"
      :has-sidebar="true"
    >
      <template #main>
        <v-card class="form-card">
          <v-card-title class="form-card-title">
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
      </template>

      <template #sidebar>
        <LLMGuide page="train" />
      </template>
    </PageStructure>

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
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'
import { usePrismaStore } from '~/stores/usePrismaStore'

// Composables
const router = useRouter()
const { createTrainingSession, updateTrainingSession } = usePrismaStore()
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
    const trainingSession = {
      name: form.value.name,
      baseModel: form.value.baseModel,
      trainingType: form.value.trainingType,
      description: form.value.description,
      parameters: form.value.parameters,
      status: 'pending'
    }

    const data = await createTrainingSession(trainingSession)

    currentTrainingJob.value = data
    totalEpochs.value = form.value.parameters.epochs

    // Start training progress simulation
    startTrainingProgress()
    
    // Show training dialog
    trainingDialog.value = true
    
    showSnackbar('Training started successfully!', 'success')
    
  } catch (error) {
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
    await updateTrainingSession(currentTrainingJob.value.id, {
      status,
      logs: trainingLogs.value
    })
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
/* Page Structure */
.page-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(248, 250, 252, 0.1) 100%);
  backdrop-filter: blur(10px);
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.05);
  padding: 2rem 0;
  margin-bottom: 2rem;
}

.page-header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-button {
  flex-shrink: 0;
}

.page-title-content {
  flex: 1;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

/* Main Content */
.page-content {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem 2rem;
  width: 100%;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  align-items: start;
}

/* Main Content Area */
.main-content {
  min-width: 0;
}

.form-card {
  background: rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(26px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.025);
  overflow: hidden;
}

.form-card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #000000;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
  padding: 1.5rem 1.5rem 1rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(248, 250, 252, 0.04) 100%);
  backdrop-filter: blur(13px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.025);
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: sticky;
  top: 2rem;
}

.sidebar-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.sidebar-card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  padding: 1.25rem 1.25rem 0.75rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.8) 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

/* Form Elements */
.v-text-field,
.v-select,
.v-textarea,
.v-file-input {
  margin-bottom: 1rem;
}

.v-text-field :deep(.v-field),
.v-select :deep(.v-field),
.v-textarea :deep(.v-field),
.v-file-input :deep(.v-field) {
  background: rgba(255, 255, 255, 0.015);
  backdrop-filter: blur(13px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.v-text-field :deep(.v-field__input),
.v-select :deep(.v-field__input),
.v-textarea :deep(.v-field__input),
.v-file-input :deep(.v-field__input) {
  color: #000000 !important;
}

.v-text-field :deep(.v-label),
.v-select :deep(.v-label),
.v-textarea :deep(.v-label),
.v-file-input :deep(.v-label) {
  color: #000000 !important;
}

.v-text-field :deep(.v-field:hover),
.v-select :deep(.v-field:hover),
.v-textarea :deep(.v-field:hover),
.v-file-input :deep(.v-field:hover) {
  border-color: rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.1);
}

.v-text-field :deep(.v-field--focused),
.v-select :deep(.v-field--focused),
.v-textarea :deep(.v-field--focused),
.v-file-input :deep(.v-field--focused) {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.1);
}

/* Buttons */
.v-btn {
  border-radius: 8px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.025em;
  transition: all 0.2s ease;
}

.v-btn--variant-elevated {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.v-btn--variant-elevated:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

/* Expansion Panels */
.v-expansion-panels {
  box-shadow: none;
}

.v-expansion-panel {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: rgba(255, 255, 255, 0.015);
  backdrop-filter: blur(13px);
}

.v-expansion-panel :deep(.v-expansion-panel-title) {
  font-weight: 500;
  color: #1a1a1a;
}

/* Code Blocks */
pre {
  background: rgba(var(--v-theme-surface-variant), 0.1);
  padding: 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

/* List Items */
.v-list-item {
  border-radius: 6px;
  margin-bottom: 0.25rem;
}

.v-list-item :deep(.v-list-item-title) {
  font-weight: 500;
  color: #000000;
}

.v-list-item :deep(.v-list-item-subtitle) {
  color: #000000;
}

.v-expansion-panel :deep(.v-expansion-panel-title) {
  font-weight: 500;
  color: #000000;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .content-wrapper {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .sidebar {
    position: static;
    order: -1;
  }
  
  .page-title {
    font-size: 2rem;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 1.5rem 0;
    margin-bottom: 1.5rem;
  }
  
  .page-header-content {
    padding: 0 1rem;
  }
  
  .page-content {
    padding: 0 1rem 1.5rem;
  }
  
  .page-title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .page-title {
    font-size: 1.75rem;
  }
  
  .page-subtitle {
    font-size: 1rem;
  }
  
  .content-wrapper {
    gap: 1rem;
  }
  
  .form-card-title,
  .sidebar-card-title {
    font-size: 1.125rem;
    padding: 1rem 1rem 0.5rem;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 1rem 0;
  }
  
  .page-content {
    padding: 0 0.75rem 1rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .form-card-title,
  .sidebar-card-title {
    font-size: 1rem;
    padding: 0.75rem 0.75rem 0.5rem;
  }
}

/* Animation */
.page-wrapper {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Card Hover Effects */
.form-card:hover,
.sidebar-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

/* Loading States */
.v-btn--loading {
  position: relative;
  overflow: hidden;
}

.v-btn--loading::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: loading-shimmer 1.5s infinite;
}

@keyframes loading-shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Ensure all text is black for visibility */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.form-card-title) {
  color: black !important;
}

/* Ensure form labels are black */
:deep(.v-label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-label--floating) {
  color: rgba(0, 0, 0, 0.6) !important;
}

/* Ensure input text is black */
:deep(.v-field__input) {
  color: black !important;
}

:deep(.v-field__input input) {
  color: black !important;
}

:deep(.v-field__input textarea) {
  color: black !important;
}

/* Ensure placeholder text is visible */
:deep(.v-field__input::placeholder) {
  color: rgba(0, 0, 0, 0.5) !important;
}

/* Ensure hint text is visible */
:deep(.v-messages) {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Ensure alert text is black */
:deep(.v-alert) {
  color: black !important;
}

:deep(.v-alert strong) {
  color: black !important;
}

/* Ensure expansion panel text is black */
:deep(.v-expansion-panel-text) {
  color: black !important;
}

/* Ensure switch labels are black */
:deep(.v-switch .v-label) {
  color: black !important;
}

/* Ensure chip text is black */
:deep(.v-chip) {
  color: black !important;
}

/* Ensure button text is black */
:deep(.v-btn) {
  color: black !important;
}

/* Ensure all text elements are black */
:deep(.text-body-1),
:deep(.text-body-2),
:deep(.text-caption) {
  color: black !important;
}

/* Ensure sidebar text is black */
:deep(.sidebar-card .v-card-text) {
  color: black !important;
}

:deep(.sidebar-card .v-card-title) {
  color: black !important;
}
</style>
