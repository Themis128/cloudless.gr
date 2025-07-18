<template>
  <div class="input-processor-config">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon start>
          mdi-cog
        </v-icon>
        Configure Input Processor
      </v-card-title>
      
      <v-card-text>
        <!-- Source Configuration -->
        <v-expansion-panels>
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>
                mdi-database-import
              </v-icon>
              Source Configuration
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <!-- Source Type Selection -->
              <v-select
                v-model="inputConfig.source.type"
                :items="sourceTypes"
                label="Source Type"
                @update:model-value="handleSourceTypeChange"
              />

              <!-- Source-specific Configuration -->
              <template v-if="inputConfig.source.type === 'text' && inputConfig.source.text">
                <!-- Text Configuration -->
                <v-text-field
                  v-model="inputConfig.source.text.content"
                  label="Content"
                  class="mb-2"
                />
                <v-select
                  v-model="inputConfig.source.text.encoding"
                  :items="['utf-8', 'ascii', 'iso-8859-1']"
                  label="Text Encoding"
                  class="mb-2"
                />
              </template>

              <template v-if="inputConfig.source.type === 'file' && inputConfig.source.file">
                <!-- File Configuration -->
                <v-combobox
                  v-model="inputConfig.source.file.allowedTypes"
                  label="Allowed Types"
                  multiple
                  chips
                  hint="e.g., .txt, .json, .csv"
                  persistent-hint
                  class="mb-2"
                />
                <v-text-field
                  v-model.number="inputConfig.source.file.maxSize"
                  type="number"
                  label="Maximum File Size (MB)"
                  min="1"
                  class="mb-2"
                />
                <v-text-field
                  v-model.number="inputConfig.source.file.concurrent"
                  type="number"
                  label="Concurrent Uploads"
                  min="1"
                  class="mb-2"
                />
                <v-switch
                  v-model="inputConfig.source.file.preserveOriginal"
                  label="Preserve Original Files"
                  class="mb-2"
                />
                <v-text-field
                  v-model="inputConfig.source.file.storagePath"
                  label="Storage Path"
                  hint="Path to store uploaded files"
                  persistent-hint
                  class="mb-2"
                />
              </template>

              <template v-if="inputConfig.source.type === 'api' && inputConfig.source.api">
                <!-- API Configuration -->
                <v-text-field
                  v-model="inputConfig.source.api.endpoint"
                  label="API Endpoint"
                  class="mb-2"
                />
                <v-select
                  v-model="inputConfig.source.api.method"
                  :items="['GET', 'POST', 'PUT', 'DELETE']"
                  label="HTTP Method"
                  class="mb-2"
                />
                <v-expansion-panels>
                  <v-expansion-panel>
                    <v-expansion-panel-title>Headers</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-textarea
                        v-model="headersText"
                        label="Headers (JSON)"
                        @input="updateHeaders"
                      />
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                  <v-expansion-panel>
                    <v-expansion-panel-title>Authentication</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <template v-if="inputConfig.source.api?.authentication">
                        <v-select
                          v-model="inputConfig.source.api.authentication.type"
                          :items="['none', 'basic', 'bearer', 'api_key']"
                          label="Auth Type"
                          class="mb-2"
                        />
                        <template v-if="inputConfig.source.api.authentication.type === 'bearer'">
                          <v-text-field
                            v-model="inputConfig.source.api.authentication.token"
                            label="Bearer Token"
                            type="password"
                            class="mb-2"
                          />
                        </template>
                        <template v-if="inputConfig.source.api.authentication.type === 'basic'">
                          <v-text-field
                            v-model="inputConfig.source.api.authentication.username"
                            label="Username"
                            class="mb-2"
                          />
                          <v-text-field
                            v-model="inputConfig.source.api.authentication.password"
                            label="Password"
                            type="password"
                            class="mb-2"
                          />
                        </template>
                        <template v-if="inputConfig.source.api.authentication.type === 'api_key'">
                          <v-text-field
                            v-model="inputConfig.source.api.authentication.key"
                            label="API Key"
                            type="password"
                            class="mb-2"
                          />
                        </template>
                      </template>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>

              <template v-if="inputConfig.source.type === 'database' && inputConfig.source.database">
                <!-- Database Configuration -->
                <v-select
                  v-model="inputConfig.source.database.type"
                  :items="['mysql', 'postgresql', 'mongodb', 'sqlite']"
                  label="Database Type"
                  class="mb-2"
                />
                <v-text-field
                  v-model="inputConfig.source.database.connection"
                  label="Connection String"
                  type="password"
                  class="mb-2"
                />
                <v-text-field
                  v-model="inputConfig.source.database.tableName"
                  label="Table Name"
                  class="mb-2"
                />
                <v-textarea
                  v-model="inputConfig.source.database.query"
                  label="Query"
                  rows="4"
                  class="mb-2"
                />
                <v-text-field
                  v-model.number="inputConfig.source.database.batchSize"
                  type="number"
                  label="Batch Size"
                  min="1"
                  class="mb-2"
                />
                <v-text-field
                  v-model.number="inputConfig.source.database.timeoutSeconds"
                  type="number"
                  label="Timeout (seconds)"
                  min="1"
                  class="mb-2"
                />
              </template>

              <template v-if="inputConfig.source.type === 'stream' && inputConfig.source.stream">
                <!-- Stream Configuration -->
                <v-select
                  v-model="inputConfig.source.stream.type"
                  :items="['websocket', 'sse', 'mqtt', 'kafka']"
                  label="Stream Protocol"
                  class="mb-2"
                />
                <v-text-field
                  v-model="inputConfig.source.stream.endpoint"
                  label="Stream Endpoint"
                  class="mb-2"
                />
                <v-combobox
                  v-model="inputConfig.source.stream.topics"
                  label="Topics"
                  multiple
                  chips
                  class="mb-2"
                />
                <v-text-field
                  v-model.number="inputConfig.source.stream.bufferSize"
                  type="number"
                  label="Buffer Size"
                  min="1"
                  class="mb-2"
                />
              </template>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Preprocessing Options -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>
                mdi-cog-transfer
              </v-icon>
              Preprocessing Options
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <template v-if="preprocessingConfig">
                <v-switch
                  v-model="preprocessingConfig.cleanText"
                  label="Clean Text"
                />
                <v-switch
                  v-model="preprocessingConfig.removeStopwords"
                  label="Remove Stopwords"
                />
                <v-switch
                  v-model="preprocessingConfig.lowercase"
                  label="Convert to Lowercase"
                />
                <v-switch
                  v-model="preprocessingConfig.trim"
                  label="Trim Whitespace"
                />
                <v-switch
                  v-model="preprocessingConfig.normalizeWhitespace"
                  label="Normalize Whitespace"
                />
                <v-switch
                  v-model="preprocessingConfig.removeSpecialChars"
                  label="Remove Special Characters"
                />

                <v-expansion-panels>
                  <v-expansion-panel>
                    <v-expansion-panel-title>Custom Replacements</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-btn
                        color="primary"
                        size="small"
                        @click="addCustomReplacement"
                      >
                        Add Replacement
                      </v-btn>
                      <div
                        v-for="(replacement, index) in preprocessingConfig.customReplacements"
                        :key="index"
                        class="d-flex align-center gap-2 mt-2"
                      >
                        <v-text-field
                          v-model="replacement.pattern"
                          label="Pattern"
                          density="compact"
                        />
                        <v-text-field
                          v-model="replacement.replacement"
                          label="Replacement"
                          density="compact"
                        />
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          @click="() => removeCustomReplacement(index)"
                        />
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel>
                    <v-expansion-panel-title>Tokenization</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-switch
                        v-model="preprocessingConfig.tokenization.enabled"
                        label="Enable Tokenization"
                      />
                      <template v-if="preprocessingConfig.tokenization?.enabled">
                        <v-select
                          v-model="preprocessingConfig.tokenization.method"
                          :items="['word', 'sentence', 'character']"
                          label="Tokenization Method"
                        />
                        <v-text-field
                          v-model="preprocessingConfig.tokenization.customSeparator"
                          label="Custom Separator"
                          hint="Leave empty for default"
                        />
                      </template>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel>
                    <v-expansion-panel-title>Encoding</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <template v-if="preprocessingConfig.encoding">
                        <v-select
                          v-model="preprocessingConfig.encoding.type"
                          :items="['utf8', 'ascii', 'base64']"
                          label="Encoding Type"
                        />
                        <v-select
                          v-model="preprocessingConfig.encoding.handleErrors"
                          :items="['skip', 'replace', 'strict']"
                          label="Error Handling"
                        />
                      </template>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Validation Rules -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>
                mdi-check-circle
              </v-icon>
              Validation Rules
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <template v-if="validationConfig">
                <v-switch
                  v-model="validationConfig.required"
                  label="Required"
                />
                <v-text-field
                  v-model.number="validationConfig.minLength"
                  label="Minimum Length"
                  type="number"
                />
                <v-text-field
                  v-model.number="validationConfig.maxLength"
                  label="Maximum Length"
                  type="number"
                />
                <v-text-field
                  v-model="validationConfig.pattern"
                  label="Validation Pattern (Regex)"
                />

                <v-expansion-panels>
                  <v-expansion-panel>
                    <v-expansion-panel-title>Data Type</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-select
                        v-model="validationConfig.dataType.type"
                        :items="['string', 'number', 'boolean', 'object', 'array']"
                        label="Data Type"
                      />
                      <v-text-field
                        v-model="validationConfig.dataType.format"
                        label="Format"
                        hint="e.g., email, date, url"
                      />
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel>
                    <v-expansion-panel-title>Range</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <template v-if="validationConfig.range">
                        <v-text-field
                          v-model.number="validationConfig.range.min"
                          label="Minimum Value"
                          type="number"
                        />
                        <v-text-field
                          v-model.number="validationConfig.range.max"
                          label="Maximum Value"
                          type="number"
                        />
                      </template>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel>
                    <v-expansion-panel-title>Custom Validators</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-btn
                        color="primary"
                        size="small"
                        @click="addCustomValidator"
                      >
                        Add Validator
                      </v-btn>
                      <div
                        v-for="(validator, index) in validationConfig.custom"
                        :key="index"
                        class="mt-2"
                      >
                        <v-text-field
                          v-model="validator.name"
                          label="Validator Name"
                          density="compact"
                        />
                        <v-textarea
                          v-model="validator.validator"
                          label="Validator Function"
                          rows="3"
                          density="compact"
                          hint="JavaScript function as string"
                        />
                        <v-text-field
                          v-model="validator.errorMessage"
                          label="Error Message"
                          density="compact"
                        />
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          @click="() => removeCustomValidator(index)"
                        />
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Error Handling -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>
                mdi-alert
              </v-icon>
              Error Handling
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <template v-if="errorHandlingConfig">
                <v-select
                  v-model="errorHandlingConfig.onValidationFail"
                  :items="['skip', 'stop', 'mark_invalid']"
                  label="On Validation Fail"
                />
                <v-text-field
                  v-model.number="errorHandlingConfig.retryStrategy.maxRetries"
                  type="number"
                  label="Max Retries"
                  min="0"
                />
                <v-text-field
                  v-model.number="errorHandlingConfig.retryStrategy.retryDelayMs"
                  type="number"
                  label="Retry Delay (ms)"
                  min="0"
                />
                <v-select
                  v-model="errorHandlingConfig.logging.level"
                  :items="['debug', 'info', 'warn', 'error']"
                  label="Log Level"
                />
                <v-switch
                  v-model="errorHandlingConfig.logging.includeDetails"
                  label="Include Details in Logs"
                />
              </template>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Performance Settings -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>
                mdi-speedometer
              </v-icon>
              Performance Settings
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <template v-if="performanceConfig">
                <v-switch
                  v-model="performanceConfig.parallelProcessing"
                  label="Enable Parallel Processing"
                />
                <v-text-field
                  v-model.number="performanceConfig.maxThreads"
                  type="number"
                  label="Max Threads"
                  min="1"
                />
                <v-text-field
                  v-model.number="performanceConfig.memoryLimitMb"
                  type="number"
                  label="Memory Limit (MB)"
                  min="1"
                />
                <v-text-field
                  v-model.number="performanceConfig.timeoutSeconds"
                  type="number"
                  label="Timeout (seconds)"
                  min="1"
                />
              </template>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
      
      <!-- Navigation Buttons -->
      <v-card-actions>
        <v-btn
          color="secondary"
          variant="outlined"
          @click="router.push('/pipelines/create/model-selection')"
        >
          Back
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!isValid"
          @click="savePipelineConfig"
        >
          Continue
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import StepUploader from '~/components/pipelines/steps/StepUploader.vue'
import type { PipelineStepType } from '~/types/Pipeline'

interface PipelineStep {
  id: number
  name: string
  type: PipelineStepType
  config: string
}

interface StepTypeInfo {
  color: string
  icon: string
  description: string
}

interface InputProcessorConfig {
  source: {
    type: 'text' | 'file' | 'api' | 'database' | 'stream'
    text?: {
      content: string
      encoding?: string
    }
    file?: {
      allowedTypes: string[]
      maxSize: number
      concurrent: number
      preserveOriginal: boolean
      storagePath: string
    }
    api?: {
      endpoint: string
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      headers: Record<string, string>
      authentication?: {
        type: 'bearer' | 'basic' | 'api_key'
        token?: string
        username?: string
        password?: string
        key?: string
      }
    }
    database?: {
      type: 'mysql' | 'postgresql' | 'mongodb' | 'sqlite'
      connection: string
      tableName: string
      query: string
      batchSize: number
      timeoutSeconds: number
    }
    stream?: {
      type: 'websocket' | 'sse' | 'mqtt' | 'kafka'
      endpoint: string
      topics?: string[]
      bufferSize?: number
    }
  }
  preprocessing: {
    cleanText: boolean
    removeStopwords: boolean
    lowercase: boolean
    trim: boolean
    normalizeWhitespace: boolean
    removeSpecialChars: boolean
    customReplacements?: Array<{
      pattern: string
      replacement: string
    }>
    tokenization: {
      enabled: boolean
      method: 'word' | 'sentence' | 'character'
      customSeparator?: string
    }
    encoding: {
      type: 'utf8' | 'ascii' | 'base64'
      handleErrors: 'skip' | 'replace' | 'strict'
    }
  }
  validation: {
    required: boolean
    minLength?: number
    maxLength?: number
    pattern?: string
    dataType: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array'
      format?: string
    }
    range?: {
      min?: number
      max?: number
    }
    custom?: Array<{
      name: string
      validator: string
      errorMessage: string
    }>
  }
  errorHandling: {
    onValidationFail: 'skip' | 'stop' | 'mark_invalid'
    retryStrategy: {
      maxRetries: number
      retryDelayMs: number
    }
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error'
      includeDetails: boolean
    }
  }
  performance: {
    parallelProcessing: boolean
    maxThreads: number
    memoryLimitMb: number
    timeoutSeconds: number
  }
}

const router = useRouter()
const loading = ref(false)
const showStepDialog = ref(false)
const editingStepIndex = ref(-1)
const configError = ref('')
const drag = ref(false)
const showUploader = ref(false)

const headersText = ref('')

function updateHeaders() {
  try {
    if (inputConfig.value.source.api?.headers) {
      inputConfig.value.source.api.headers = JSON.parse(headersText.value)
    }
  } catch (e) {
    // Handle invalid JSON
    console.error('Invalid JSON in headers:', e)
  }
}

const sourceTypes = [
  { title: 'Text Input', value: 'text', icon: 'mdi-text', description: 'Process raw text input with optional encoding and length constraints' },
  { title: 'File Upload', value: 'file', icon: 'mdi-file', description: 'Handle file uploads with format validation and concurrent processing' },
  { title: 'API Endpoint', value: 'api', icon: 'mdi-api', description: 'Fetch data from REST APIs with authentication and retry handling' },
  { title: 'Database', value: 'database', icon: 'mdi-database', description: 'Connect to databases for structured data retrieval' },
  { title: 'Data Stream', value: 'stream', icon: 'mdi-transit-connection-variant', description: 'Process real-time data streams with buffering and reconnection handling' }
]

function handleSourceTypeChange(type: string) {
  const newSource = {
    type: type as 'text' | 'file' | 'api' | 'database' | 'stream'
  } as InputProcessorConfig['source']
  
  switch (type) {
    case 'text':
      newSource.text = { content: '', encoding: 'utf-8' }
      break
    case 'file':
      newSource.file = {
        allowedTypes: [],
        maxSize: 10,
        concurrent: 1,
        preserveOriginal: false,
        storagePath: ''
      }
      break
    case 'api':
      newSource.api = {
        endpoint: '',
        method: 'GET',
        headers: {},
        authentication: {
          type: 'bearer',
          token: ''
        }
      }
      break
    case 'database':
      newSource.database = {
        type: 'mysql',
        connection: '',
        tableName: '',
        query: '',
        batchSize: 1000,
        timeoutSeconds: 30
      }
      break
    case 'stream':
      newSource.stream = {
        type: 'websocket',
        endpoint: '',
        topics: [],
        bufferSize: 1000
      }
      break
  }

  inputConfig.value = {
    ...inputConfig.value,
    source: newSource
  }
}

const stepTypes: PipelineStepType[] = [
  'input_processor',
  'llm_processor',
  'output_processor',
  'data_transformer',
  'validator'
]

const steps = ref<PipelineStep[]>([])
const editingStep = ref<PipelineStep | null>(null)

// Initialize inputConfig with default values
const inputConfig = ref<InputProcessorConfig>({
  source: {
    type: 'text',
    text: {
      content: '',
      encoding: 'utf-8'
    }
  },
  preprocessing: {
    cleanText: true,
    removeStopwords: false,
    lowercase: true,
    trim: true,
    normalizeWhitespace: true,
    removeSpecialChars: false,
    tokenization: {
      enabled: false,
      method: 'word'
    },
    encoding: {
      type: 'utf8',
      handleErrors: 'replace'
    }
  },
  validation: {
    required: true,
    dataType: {
      type: 'string'
    }
  },
  errorHandling: {
    onValidationFail: 'skip',
    retryStrategy: {
      maxRetries: 3,
      retryDelayMs: 1000
    },
    logging: {
      level: 'info',
      includeDetails: false
    }
  },
  performance: {
    parallelProcessing: false,
    maxThreads: 4,
    memoryLimitMb: 1024,
    timeoutSeconds: 30
  }
})

// Add computed properties for type-safe access
const sourceText = computed(() => inputConfig.value.source.text)
const sourceFile = computed(() => inputConfig.value.source.file)
const sourceApi = computed(() => inputConfig.value.source.api)
const sourceDatabase = computed(() => inputConfig.value.source.database)
const sourceStream = computed(() => inputConfig.value.source.stream)
const preprocessingConfig = computed(() => inputConfig.value.preprocessing)
const validationConfig = computed(() => inputConfig.value.validation)
const errorHandlingConfig = computed(() => inputConfig.value.errorHandling)
const performanceConfig = computed(() => inputConfig.value.performance)

// Watch for changes in API headers to update headersText
watch(() => inputConfig.value.source.api?.headers, (newHeaders) => {
  headersText.value = JSON.stringify(newHeaders, null, 2)
}, { immediate: true })

async function savePipelineConfig() {
  if (!isValid.value) return
  
  loading.value = true
  try {
    // Create a pipeline step from the input processor configuration
    const inputProcessorStep = {
      id: Date.now(),
      name: 'Input Processor',
      type: 'input_processor' as const,
      config: JSON.stringify(inputConfig.value)
    }
    
    // Save the step to localStorage
    const existingSteps = JSON.parse(localStorage.getItem('pipelineSteps') || '[]')
    const updatedSteps = [inputProcessorStep, ...existingSteps.filter((step: any) => step.type !== 'input_processor')]
    
    localStorage.setItem('pipelineSteps', JSON.stringify(updatedSteps))
    router.push('/pipelines/create/review')
  } catch (error) {
    console.error('Error saving pipeline config:', error)
  } finally {
    loading.value = false
  }
}

function handleUploaderError(message: string) {
  // Handle upload errors (e.g., show a notification)
  console.error('Upload error:', message)
}

const isValid = computed(() => {
  // For input processor configuration, we need at least a valid source type
  return inputConfig.value.source.type && 
         (inputConfig.value.source.type === 'text' ? 
          inputConfig.value.source.text?.content : true)
})

function formatStepType(type: PipelineStepType) {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const stepTypeInfo: Record<PipelineStepType, StepTypeInfo> = {
  input_processor: {
    color: 'blue',
    icon: 'mdi-database-import',
    description: 'Handles data input and initial preprocessing'
  },
  llm_processor: {
    color: 'purple',
    icon: 'mdi-brain',
    description: 'Processes data using the selected language model'
  },
  output_processor: {
    color: 'green',
    icon: 'mdi-database-export',
    description: 'Formats and structures the model output'
  },
  data_transformer: {
    color: 'orange',
    icon: 'mdi-transform',
    description: 'Transforms data between processing steps'
  },
  validator: {
    color: 'red',
    icon: 'mdi-check-circle',
    description: 'Validates data against defined rules'
  }
}

function getStepTypeColor(type: PipelineStepType) {
  return stepTypeInfo[type]?.color || 'grey'
}

function getStepTypeIcon(type: PipelineStepType) {
  return stepTypeInfo[type]?.icon || 'mdi-cog'
}

function getStepTypeDescription(type: PipelineStepType) {
  return stepTypeInfo[type]?.description || ''
}

function addStep() {
  const newStep: PipelineStep = {
    id: Date.now(),
    name: `Step ${steps.value.length + 1}`,
    type: 'input_processor',
    config: '{}'
  }
  steps.value.push(newStep)
}

function editStep(index: number) {
  editingStepIndex.value = index
  editingStep.value = JSON.parse(JSON.stringify(steps.value[index]))
  
  if (editingStep.value?.type === 'input_processor') {
    try {
      const config = JSON.parse(editingStep.value.config)
      inputConfig.value = {
        source: config.source || {
          type: 'text',
          text: { content: '', encoding: 'utf-8' }
        },
        preprocessing: config.preprocessing || {
          cleanText: true,
          removeStopwords: false,
          lowercase: true,
          trim: true,
          normalizeWhitespace: true,
          removeSpecialChars: false,
          tokenization: {
            enabled: false,
            method: 'word'
          },
          encoding: {
            type: 'utf8',
            handleErrors: 'replace'
          }
        },
        validation: config.validation || {
          required: true,
          dataType: {
            type: 'string'
          }
        },
        errorHandling: config.errorHandling || {
          onValidationFail: 'skip',
          retryStrategy: {
            maxRetries: 3,
            retryDelayMs: 1000
          },
          logging: {
            level: 'info',
            includeDetails: false
          }
        },
        performance: config.performance || {
          parallelProcessing: false,
          maxThreads: 4,
          memoryLimitMb: 1024,
          timeoutSeconds: 30
        }
      }
    } catch {
      // If config is invalid or empty, use default config
      inputConfig.value = {
        source: {
          type: 'text',
          text: { content: '', encoding: 'utf-8' }
        },
        preprocessing: {
          cleanText: true,
          removeStopwords: false,
          lowercase: true,
          trim: true,
          normalizeWhitespace: true,
          removeSpecialChars: false,
          tokenization: {
            enabled: false,
            method: 'word'
          },
          encoding: {
            type: 'utf8',
            handleErrors: 'replace'
          }
        },
        validation: {
          required: true,
          dataType: {
            type: 'string'
          }
        },
        errorHandling: {
          onValidationFail: 'skip',
          retryStrategy: {
            maxRetries: 3,
            retryDelayMs: 1000
          },
          logging: {
            level: 'info',
            includeDetails: false
          }
        },
        performance: {
          parallelProcessing: false,
          maxThreads: 4,
          memoryLimitMb: 1024,
          timeoutSeconds: 30
        }
      }
    }
  }
  
  showStepDialog.value = true
}

function removeStep(index: number) {
  steps.value.splice(index, 1)
}

function addCustomReplacement() {
  if (preprocessingConfig.value) {
    preprocessingConfig.value.customReplacements?.push({ pattern: '', replacement: '' })
  }
}

function removeCustomReplacement(index: number) {
  if (preprocessingConfig.value) {
    preprocessingConfig.value.customReplacements?.splice(index, 1)
  }
}

function addCustomValidator() {
  if (validationConfig.value) {
    validationConfig.value.custom?.push({ name: '', validator: '', errorMessage: '' })
  }
}

function removeCustomValidator(index: number) {
  if (validationConfig.value) {
    validationConfig.value.custom?.splice(index, 1)
  }
}

function saveStepConfig() {
  const step = editingStep.value
  if (!step || editingStepIndex.value === -1) return

  const updatedStep = { ...step }
  if (updatedStep.type === 'input_processor') {
    updatedStep.config = JSON.stringify(inputConfig.value)
  }

  steps.value[editingStepIndex.value] = updatedStep
  showStepDialog.value = false
  editingStep.value = null
  editingStepIndex.value = -1
}
</script>

<style scoped>
.drag-handle {
  cursor: move;
}

.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

.list-group {
  min-height: 20px;
}

.dragging {
  cursor: move;
}

.v-list-item {
  transition: all 0.3s;
}

.v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.input-processor-config {
  max-width: 800px;
  margin: 0 auto;
}

.v-expansion-panels {
  margin-bottom: 1rem;
}
</style> 