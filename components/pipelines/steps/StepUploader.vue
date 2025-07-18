<template>
  <div class="step-uploader">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">mdi-file-upload</v-icon>
        Upload Pipeline Steps
      </v-card-title>
      
      <v-card-text>
        <p class="text-body-2 mb-4">
          Upload your pipeline steps configuration file in JSON format. The file should follow the required schema:
        </p>

        <!-- Schema Example -->
        <v-expansion-panels class="mb-4">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>mdi-code-json</v-icon>
              Required Schema
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <pre class="schema-example">
{
  "steps": [
    {
      "id": number,
      "name": string,
      "type": "input_processor" | "llm_processor" | "output_processor" | "data_transformer" | "validator",
      "config": {
        // Configuration object based on step type
        // See schema documentation for type-specific fields
      }
    }
  ]
}</pre>
              <v-btn
                color="primary"
                variant="text"
                size="small"
                prepend-icon="mdi-download"
                class="mt-2"
                @click="downloadTemplate"
              >
                Download Template
              </v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- File Upload -->
        <v-file-input
          v-model="file"
          accept=".json"
          label="Upload Steps Configuration"
          :rules="[v => !v || v.size < 1000000 || 'File size should be less than 1 MB']"
          :error-messages="errorMessage ? [errorMessage] : []"
          show-size
          class="mb-4"
          @change="handleFileChange"
        />

        <!-- Preview -->
        <template v-if="parsedSteps.length > 0">
          <div class="d-flex align-center mb-2">
            <h3>Uploaded Steps</h3>
            <v-spacer />
            <v-btn
              color="error"
              variant="text"
              size="small"
              prepend-icon="mdi-delete"
              @click="clearUpload"
            >
              Clear
            </v-btn>
          </div>

          <v-list>
            <v-list-item
              v-for="(step, index) in parsedSteps"
              :key="step.id"
              :title="step.name"
              :subtitle="formatStepType(step.type)"
            >
              <template #prepend>
                <v-icon :color="getStepTypeColor(step.type)">
                  {{ getStepTypeIcon(step.type) }}
                </v-icon>
              </template>
              <template #append>
                <v-chip
                  :color="isStepValid(step) ? 'success' : 'error'"
                  size="small"
                >
                  {{ isStepValid(step) ? 'Valid' : 'Invalid' }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PipelineStep, PipelineStepType } from '~/types/Pipeline'

const props = defineProps<{
  modelValue: PipelineStep[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: PipelineStep[]): void
  (e: 'error', message: string): void
}>()

const file = ref<File | null>(null)
const errorMessage = ref('')
const parsedSteps = ref<PipelineStep[]>([])

// Step type styling
const stepTypeInfo: Record<PipelineStepType, { color: string; icon: string }> = {
  input_processor: { color: 'blue', icon: 'mdi-database-import' },
  llm_processor: { color: 'purple', icon: 'mdi-brain' },
  output_processor: { color: 'green', icon: 'mdi-database-export' },
  data_transformer: { color: 'orange', icon: 'mdi-transform' },
  validator: { color: 'red', icon: 'mdi-check-circle' }
}

function getStepTypeColor(type: PipelineStepType): string {
  return stepTypeInfo[type]?.color || 'grey'
}

function getStepTypeIcon(type: PipelineStepType): string {
  return stepTypeInfo[type]?.icon || 'mdi-cog'
}

function formatStepType(type: PipelineStepType): string {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

// Validation functions
function isStepValid(step: PipelineStep): boolean {
  if (!step.id || !step.name || !step.type || !step.config) {
    return false
  }

  // Validate step type
  if (!Object.keys(stepTypeInfo).includes(step.type)) {
    return false
  }

  // Validate config based on step type
  try {
    const config = typeof step.config === 'string' ? JSON.parse(step.config) : step.config
    
    switch (step.type) {
      case 'input_processor':
        return validateInputProcessorConfig(config)
      case 'llm_processor':
        return validateLLMProcessorConfig(config)
      case 'output_processor':
        return validateOutputProcessorConfig(config)
      case 'data_transformer':
        return validateDataTransformerConfig(config)
      case 'validator':
        return validateValidatorConfig(config)
      default:
        return false
    }
  } catch {
    return false
  }
}

function validateInputProcessorConfig(config: any): boolean {
  return !!(config.source && config.source.type)
}

function validateLLMProcessorConfig(config: any): boolean {
  return !!(config.model && config.params)
}

function validateOutputProcessorConfig(config: any): boolean {
  return !!(config.format)
}

function validateDataTransformerConfig(config: any): boolean {
  return !!(config.transformations && Array.isArray(config.transformations))
}

function validateValidatorConfig(config: any): boolean {
  return !!(config.rules && Array.isArray(config.rules))
}

// File handling
async function handleFileChange(uploadedFile: File | null) {
  errorMessage.value = ''
  parsedSteps.value = []
  
  if (!uploadedFile) return

  try {
    const content = await uploadedFile.text()
    const data = JSON.parse(content)

    if (!data.steps || !Array.isArray(data.steps)) {
      throw new Error('Invalid file format: Missing or invalid steps array')
    }

    // Validate each step
    const steps = data.steps as PipelineStep[]
    const invalidSteps = steps.filter(step => !isStepValid(step))

    if (invalidSteps.length > 0) {
      throw new Error(`Invalid step configuration found in steps: ${invalidSteps.map(s => s.name).join(', ')}`)
    }

    parsedSteps.value = steps
    emit('update:modelValue', steps)
  } catch (err: any) {
    errorMessage.value = err.message
    emit('error', err.message)
  }
}

function clearUpload() {
  file.value = null
  parsedSteps.value = []
  errorMessage.value = ''
  emit('update:modelValue', [])
}

// Template handling
function downloadTemplate() {
  const template = {
    steps: [
      {
        id: 1,
        name: "Input Processing",
        type: "input_processor",
        config: {
          source: {
            type: "text",
            text: {
              content: "",
              encoding: "utf8"
            }
          },
          preprocessing: {
            cleanText: true,
            removeStopwords: false,
            lowercase: true
          }
        }
      },
      {
        id: 2,
        name: "LLM Processing",
        type: "llm_processor",
        config: {
          model: "gpt-3.5-turbo",
          params: {
            temperature: 0.7,
            maxTokens: 1000,
            outputFormat: "json"
          }
        }
      },
      {
        id: 3,
        name: "Output Processing",
        type: "output_processor",
        config: {
          format: "json",
          schema: {
            type: "object",
            properties: {
              result: { type: "string" }
            }
          }
        }
      }
    ]
  }

  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pipeline-steps-template.json'
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
</script>

<style scoped>
.schema-example {
  background-color: rgba(0, 0, 0, 0.03);
  padding: 1rem;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  font-size: 0.875rem;
}

.step-uploader {
  max-width: 800px;
  margin: 0 auto;
}
</style> 