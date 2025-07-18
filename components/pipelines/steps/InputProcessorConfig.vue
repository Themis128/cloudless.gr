<template>
  <div class="input-processor-config">
    <!-- Source Configuration -->
    <v-expansion-panels v-model="expandedPanel">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-database-import</v-icon>
          Source Configuration
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-select
            v-model="config.source.type"
            :items="sourceTypes"
            label="Source Type"
            @update:model-value="handleSourceTypeChange"
          />

          <!-- Text Source Config -->
          <div v-if="config.source?.type === 'text' && sourceText">
            <v-textarea
              v-model="sourceText.content"
              label="Text Content"
              rows="4"
            />
            <v-select
              v-model="sourceText.encoding"
              :items="['utf8', 'ascii', 'base64']"
              label="Encoding"
            />
          </div>

          <!-- File Source Config -->
          <div v-if="config.source?.type === 'file' && sourceFile">
            <v-text-field
              v-model="sourceFile.allowedTypes"
              label="Allowed File Types"
              hint="Comma-separated list of extensions (e.g., .txt,.csv)"
            />
            <v-text-field
              v-model.number="sourceFile.maxSize"
              label="Max File Size (MB)"
              type="number"
            />
            <v-text-field
              v-model.number="sourceFile.concurrent"
              label="Concurrent Processing"
              type="number"
              hint="Number of files to process simultaneously"
            />
          </div>

          <!-- CSV Source Config -->
          <div v-if="config.source?.type === 'csv' && sourceCsv">
            <v-text-field
              v-model="sourceCsv.delimiter"
              label="Delimiter"
              placeholder=","
              hint="Character used to separate fields"
            />
            <v-switch
              v-model="sourceCsv.hasHeader"
              label="Has Header Row"
            />
            <v-text-field
              v-model="columnsText"
              label="Column Names"
              hint="Comma-separated list of column names (if no header)"
              :disabled="sourceCsv.hasHeader"
              @input="updateColumns"
            />
            <v-text-field
              v-model.number="sourceCsv.skipRows"
              label="Skip Rows"
              type="number"
              hint="Number of rows to skip from the beginning"
            />
            <v-select
              v-model="sourceCsv.encoding"
              :items="['utf8', 'ascii', 'latin1', 'utf16le']"
              label="File Encoding"
            />
            <v-switch
              v-model="sourceCsv.trimFields"
              label="Trim Fields"
              hint="Remove whitespace from field values"
            />
            <v-switch
              v-model="sourceCsv.skipEmptyLines"
              label="Skip Empty Lines"
            />
            <v-text-field
              v-model="sourceCsv.commentChar"
              label="Comment Character"
              placeholder="#"
              hint="Lines starting with this character will be ignored"
            />
            <v-text-field
              v-model.number="sourceCsv.chunkSize"
              label="Chunk Size"
              type="number"
              hint="Number of rows to process at once"
            />
          </div>

          <!-- Sensor Source Config -->
          <div v-if="config.source?.type === 'sensor' && sourceSensor">
            <v-select
              v-model="sourceSensor.type"
              :items="sensorTypes"
              label="Sensor Type"
              @update:model-value="handleSensorTypeChange"
            />
            
            <v-select
              v-model="sourceSensor.protocol"
              :items="['mqtt', 'http', 'websocket', 'modbus', 'serial']"
              label="Communication Protocol"
            />

            <v-text-field
              v-model="sourceSensor.deviceId"
              label="Device ID"
              hint="Unique identifier for the sensor"
            />

            <v-text-field
              v-model.number="sourceSensor.interval"
              label="Polling Interval (ms)"
              type="number"
              hint="How often to read from the sensor"
            />

            <v-text-field
              v-model="sourceSensor.unit"
              label="Measurement Unit"
              :hint="getUnitHint(sourceSensor.type)"
            />

            <!-- Range Settings -->
            <v-expansion-panels v-if="sourceSensor.range">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start>mdi-chart-range</v-icon>
                  Range Settings
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model.number="sourceSensor.range.min"
                    label="Minimum Value"
                    type="number"
                  />
                  <v-text-field
                    v-model.number="sourceSensor.range.max"
                    label="Maximum Value"
                    type="number"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Connection Settings -->
              <v-expansion-panel v-if="sourceSensor.connection">
                <v-expansion-panel-title>
                  <v-icon start>mdi-connection</v-icon>
                  Connection Settings
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model="sourceSensor.connection.address"
                    label="Address"
                    :hint="getAddressHint(sourceSensor.protocol)"
                  />

                  <!-- Protocol-specific settings -->
                  <template v-if="sourceSensor.protocol === 'mqtt' && sourceSensor.connection.settings">
                    <v-text-field
                      v-model="sourceSensor.connection.settings.topic"
                      label="MQTT Topic"
                    />
                    <v-select
                      v-model="sourceSensor.connection.settings.qos"
                      :items="[0, 1, 2]"
                      label="QoS Level"
                    />
                  </template>

                  <template v-if="sourceSensor.protocol === 'serial' && sourceSensor.connection.settings">
                    <v-select
                      v-model="sourceSensor.connection.settings.baudRate"
                      :items="[9600, 19200, 38400, 57600, 115200]"
                      label="Baud Rate"
                    />
                  </template>

                  <template v-if="sourceSensor.connection.settings">
                    <v-text-field
                      v-model.number="sourceSensor.connection.settings.timeout"
                      label="Timeout (ms)"
                      type="number"
                    />

                    <v-text-field
                      v-model.number="sourceSensor.connection.settings.retries"
                      label="Retry Attempts"
                      type="number"
                    />
                  </template>

                  <!-- Credentials -->
                  <v-expansion-panel v-if="sourceSensor.connection.credentials">
                    <v-expansion-panel-title>
                      <v-icon start>mdi-key</v-icon>
                      Credentials
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-text-field
                        v-model="sourceSensor.connection.credentials.username"
                        label="Username"
                      />
                      <v-text-field
                        v-model="sourceSensor.connection.credentials.password"
                        label="Password"
                        type="password"
                      />
                      <v-text-field
                        v-model="sourceSensor.connection.credentials.apiKey"
                        label="API Key"
                        type="password"
                      />
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Preprocessing Settings -->
              <v-expansion-panel v-if="sourceSensor.preprocessing">
                <v-expansion-panel-title>
                  <v-icon start>mdi-tune</v-icon>
                  Preprocessing Settings
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-switch
                    v-model="sourceSensor.preprocessing.averaging"
                    label="Enable Rolling Average"
                  />
                  
                  <v-text-field
                    v-if="sourceSensor.preprocessing.averaging"
                    v-model.number="sourceSensor.preprocessing.windowSize"
                    label="Averaging Window Size"
                    type="number"
                  />

                  <!-- Calibration -->
                  <template v-if="sourceSensor.preprocessing.calibration">
                    <v-text-field
                      v-model.number="sourceSensor.preprocessing.calibration.offset"
                      label="Calibration Offset"
                      type="number"
                    />
                    <v-text-field
                      v-model.number="sourceSensor.preprocessing.calibration.scale"
                      label="Calibration Scale"
                      type="number"
                    />
                  </template>

                  <!-- Thresholds -->
                  <template v-if="sourceSensor.preprocessing.thresholds">
                    <v-text-field
                      v-model.number="sourceSensor.preprocessing.thresholds.low"
                      label="Low Threshold"
                      type="number"
                    />
                    <v-text-field
                      v-model.number="sourceSensor.preprocessing.thresholds.high"
                      label="High Threshold"
                      type="number"
                    />
                  </template>

                  <!-- Filters -->
                  <template v-if="sourceSensor.preprocessing.filters">
                    <v-switch
                      v-model="sourceSensor.preprocessing.filters.outliers"
                      label="Remove Outliers"
                    />
                    <v-switch
                      v-model="sourceSensor.preprocessing.filters.smoothing"
                      label="Apply Smoothing"
                    />
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- API Source Config -->
          <div v-if="config.source?.type === 'api' && sourceApi">
            <v-text-field
              v-model="sourceApi.endpoint"
              label="API Endpoint"
            />
            <v-select
              v-model="sourceApi.method"
              :items="['GET', 'POST', 'PUT', 'DELETE']"
              label="HTTP Method"
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
                  <template v-if="sourceApiAuth">
                    <v-select
                      v-model="sourceApiAuth.type"
                      :items="['bearer', 'basic', 'api_key']"
                      label="Auth Type"
                    />
                    <template v-if="sourceApiAuth.type === 'bearer'">
                      <v-text-field
                        v-model="sourceApiAuth.token"
                        label="Bearer Token"
                        type="password"
                      />
                    </template>
                    <template v-if="sourceApiAuth.type === 'basic'">
                      <v-text-field
                        v-model="sourceApiAuth.username"
                        label="Username"
                      />
                      <v-text-field
                        v-model="sourceApiAuth.password"
                        label="Password"
                        type="password"
                      />
                    </template>
                    <template v-if="sourceApiAuth.type === 'api_key'">
                      <v-text-field
                        v-model="sourceApiAuth.key"
                        label="API Key"
                        type="password"
                      />
                    </template>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- Database Source Config -->
          <div v-if="config.source?.type === 'database' && sourceDatabase">
            <v-select
              v-model="sourceDatabase.type"
              :items="['postgres', 'mysql', 'mongodb']"
              label="Database Type"
            />
            <v-text-field
              v-model="sourceDatabase.connection"
              label="Connection String"
              type="password"
            />
            <v-textarea
              v-model="sourceDatabase.query"
              label="Query"
              rows="4"
            />
            <v-textarea
              v-model="paramsText"
              label="Query Parameters (JSON)"
              @input="updateParams"
            />
          </div>

          <!-- Stream Source Config -->
          <div v-if="config.source?.type === 'stream' && sourceStream">
            <v-select
              v-model="sourceStream.type"
              :items="['websocket', 'sse', 'kafka']"
              label="Stream Type"
            />
            <v-text-field
              v-model="sourceStream.endpoint"
              label="Stream Endpoint"
            />
            <v-text-field
              v-model="sourceStream.topics"
              label="Topics"
              hint="Comma-separated list of topics"
            />
            <v-text-field
              v-model.number="sourceStream.batchSize"
              label="Batch Size"
              type="number"
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Preprocessing Options -->
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-cog-transfer</v-icon>
          Preprocessing Options
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-switch
            v-model="config.preprocessing.cleanText"
            label="Clean Text"
          />
          <v-switch
            v-model="config.preprocessing.removeStopwords"
            label="Remove Stopwords"
          />
          <v-switch
            v-model="config.preprocessing.lowercase"
            label="Convert to Lowercase"
          />
          <v-switch
            v-model="config.preprocessing.trim"
            label="Trim Whitespace"
          />
          <v-switch
            v-model="config.preprocessing.normalizeWhitespace"
            label="Normalize Whitespace"
          />
          <v-switch
            v-model="config.preprocessing.removeSpecialChars"
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
                  v-for="(replacement, index) in config.preprocessing.customReplacements"
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
                    @click="removeCustomReplacement(index)"
                  />
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Tokenization Section -->
            <v-expansion-panel>
              <v-expansion-panel-title>Tokenization</v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-switch
                  v-if="preprocessingTokenization"
                  v-model="preprocessingTokenization.enabled"
                  label="Enable Tokenization"
                />
                <template v-if="preprocessingTokenization?.enabled">
                  <v-select
                    v-model="preprocessingTokenization.method"
                    :items="['word', 'sentence', 'character']"
                    label="Tokenization Method"
                  />
                  <v-text-field
                    v-model="preprocessingTokenization.customSeparator"
                    label="Custom Separator"
                    hint="Leave empty for default"
                  />
                </template>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Encoding Section -->
            <v-expansion-panel>
              <v-expansion-panel-title>Encoding</v-expansion-panel-title>
              <v-expansion-panel-text>
                <template v-if="preprocessingEncoding">
                  <v-select
                    v-model="preprocessingEncoding.type"
                    :items="['utf8', 'ascii', 'base64']"
                    label="Encoding Type"
                  />
                  <v-select
                    v-model="preprocessingEncoding.handleErrors"
                    :items="['skip', 'replace', 'strict']"
                    label="Error Handling"
                  />
                </template>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Validation Rules -->
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-check-circle</v-icon>
          Validation Rules
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-switch
            v-model="config.validation.required"
            label="Required"
          />
          <v-text-field
            v-model.number="config.validation.minLength"
            label="Minimum Length"
            type="number"
          />
          <v-text-field
            v-model.number="config.validation.maxLength"
            label="Maximum Length"
            type="number"
          />
          <v-text-field
            v-model="config.validation.pattern"
            label="Validation Pattern (Regex)"
          />

          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-title>Data Type</v-expansion-panel-title>
              <v-expansion-panel-text>
                <template v-if="validationDataType">
                  <v-select
                    v-model="validationDataType.type"
                    :items="['string', 'number', 'boolean', 'object', 'array']"
                    label="Data Type"
                  />
                  <v-text-field
                    v-model="validationDataType.format"
                    label="Format"
                    hint="e.g., email, date, url"
                  />
                </template>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>Range</v-expansion-panel-title>
              <v-expansion-panel-text>
                <template v-if="validationRange">
                  <v-text-field
                    v-model.number="validationRange.min"
                    label="Minimum Value"
                    type="number"
                  />
                  <v-text-field
                    v-model.number="validationRange.max"
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
                  v-for="(validator, index) in config.validation.custom"
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
                    @click="removeCustomValidator(index)"
                  />
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Advanced Settings -->
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-tune</v-icon>
          Advanced Settings
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-title>Performance</v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-switch
                  v-model="config.advanced.performance.caching"
                  label="Enable Caching"
                />
                <v-text-field
                  v-model.number="config.advanced.performance.cacheTTL"
                  label="Cache TTL (seconds)"
                  type="number"
                />
                <v-text-field
                  v-model.number="config.advanced.performance.batchSize"
                  label="Batch Size"
                  type="number"
                />
                <v-text-field
                  v-model.number="config.advanced.performance.timeout"
                  label="Timeout (ms)"
                  type="number"
                />
                <v-text-field
                  v-model.number="config.advanced.performance.retryAttempts"
                  label="Retry Attempts"
                  type="number"
                />
                <v-text-field
                  v-model.number="config.advanced.performance.retryDelay"
                  label="Retry Delay (ms)"
                  type="number"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>Error Handling</v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-switch
                  v-model="config.advanced.errorHandling.continueOnError"
                  label="Continue on Error"
                />
                <v-switch
                  v-model="config.advanced.errorHandling.logErrors"
                  label="Log Errors"
                />
                <v-text-field
                  v-model.number="config.advanced.errorHandling.errorThreshold"
                  label="Error Threshold"
                  type="number"
                />
                <v-text-field
                  v-model="config.advanced.errorHandling.fallbackValue"
                  label="Fallback Value"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>Monitoring</v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-switch
                  v-model="config.advanced.monitoring.collectMetrics"
                  label="Collect Metrics"
                />
                <v-select
                  v-model="config.advanced.monitoring.logLevel"
                  :items="['debug', 'info', 'warn', 'error']"
                  label="Log Level"
                />
                <v-text-field
                  v-model.number="config.advanced.monitoring.sampleRate"
                  label="Sample Rate"
                  type="number"
                  hint="Value between 0 and 1"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type {
  InputProcessorConfig,
  SourceConfig,
  PreprocessingOptions,
  ValidationRules,
  AdvancedSettings
} from '~/types/Pipeline'

const props = defineProps<{
  modelValue: InputProcessorConfig
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: InputProcessorConfig): void
}>()

const expandedPanel = ref<number | null>(0)
const sourceTypes = ['text', 'file', 'csv', 'api', 'database', 'stream', 'sensor']
const sensorTypes = [
  'temperature',
  'humidity',
  'pressure',
  'motion',
  'light',
  'custom'
]

const config = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const headersText = ref('')
const paramsText = ref('')
const columnsText = ref('')

// Computed properties
const sourceText = computed(() => config.value?.source?.text)
const sourceFile = computed(() => config.value?.source?.file)
const sourceApi = computed(() => config.value?.source?.api)
const sourceDatabase = computed(() => config.value?.source?.database)
const sourceStream = computed(() => config.value?.source?.stream)
const sourceCsv = computed(() => config.value?.source?.csv)
const sourceSensor = computed(() => config.value?.source?.sensor)

const preprocessingTokenization = computed(() => config.value?.preprocessing?.tokenization)
const preprocessingEncoding = computed(() => config.value?.preprocessing?.encoding)
const validationDataType = computed(() => config.value?.validation?.dataType)
const validationRange = computed(() => config.value?.validation?.range)

// Add computed property for API authentication
const sourceApiAuth = computed(() => sourceApi.value?.authentication)

// Helper functions
function getUnitHint(type: string): string {
  switch (type) {
    case 'temperature':
      return 'e.g., celsius, fahrenheit'
    case 'humidity':
      return 'e.g., percent'
    case 'pressure':
      return 'e.g., hPa, bar'
    case 'light':
      return 'e.g., lux'
    default:
      return 'Measurement unit'
  }
}

function getAddressHint(protocol: string): string {
  switch (protocol) {
    case 'mqtt':
      return 'Broker URL (e.g., mqtt://localhost:1883)'
    case 'http':
      return 'HTTP endpoint URL'
    case 'websocket':
      return 'WebSocket URL'
    case 'modbus':
      return 'IP address or serial port'
    case 'serial':
      return 'Serial port (e.g., COM1, /dev/ttyUSB0)'
    default:
      return 'Connection address'
  }
}

function handleSensorTypeChange(type: string) {
  if (!sourceSensor.value) return

  // Set default unit based on sensor type
  switch (type) {
    case 'temperature':
      sourceSensor.value.unit = 'celsius'
      break
    case 'humidity':
      sourceSensor.value.unit = 'percent'
      break
    case 'pressure':
      sourceSensor.value.unit = 'hPa'
      break
    case 'light':
      sourceSensor.value.unit = 'lux'
      break
  }
}

// Helper functions for source type changes
function handleSourceTypeChange(type: string) {
  const newSource: SourceConfig = { type: type as any }
  
  switch (type) {
    case 'text':
      newSource.text = { content: '', encoding: 'utf8' }
      break
    case 'file':
      newSource.file = { allowedTypes: [], maxSize: 10, concurrent: 1 }
      break
    case 'csv':
      newSource.csv = {
        delimiter: ',',
        hasHeader: true,
        skipRows: 0,
        encoding: 'utf8',
        trimFields: true,
        skipEmptyLines: true,
        chunkSize: 1000
      }
      break
    case 'api':
      newSource.api = {
        endpoint: '',
        method: 'GET',
        headers: {},
        authentication: { type: 'bearer' }
      }
      break
    case 'database':
      newSource.database = {
        type: 'postgres',
        connection: '',
        query: '',
        params: {}
      }
      break
    case 'stream':
      newSource.stream = {
        type: 'websocket',
        endpoint: '',
        topics: [],
        batchSize: 100
      }
      break
    case 'sensor':
      newSource.sensor = {
        type: 'temperature',
        protocol: 'mqtt',
        deviceId: '',
        interval: 1000,
        unit: 'celsius',
        range: {
          min: 0,
          max: 100
        },
        connection: {
          address: '',
          settings: {
            timeout: 5000,
            retries: 3
          }
        },
        preprocessing: {
          averaging: false,
          windowSize: 10,
          calibration: {
            offset: 0,
            scale: 1
          },
          thresholds: {
            low: 0,
            high: 100
          },
          filters: {
            outliers: false,
            smoothing: false
          }
        }
      }
      break
  }

  config.value = {
    ...config.value,
    source: newSource
  }
}

// Helper function for updating CSV columns
function updateColumns(value: string) {
  if (sourceCsv.value && !sourceCsv.value.hasHeader) {
    sourceCsv.value.columns = value.split(',').map(col => col.trim())
  }
}

// Helper functions for custom replacements
function addCustomReplacement() {
  if (!config.value.preprocessing.customReplacements) {
    config.value.preprocessing.customReplacements = []
  }
  config.value.preprocessing.customReplacements.push({
    pattern: '',
    replacement: ''
  })
}

function removeCustomReplacement(index: number) {
  config.value.preprocessing.customReplacements?.splice(index, 1)
}

// Helper functions for custom validators
function addCustomValidator() {
  if (!config.value.validation.custom) {
    config.value.validation.custom = []
  }
  config.value.validation.custom.push({
    name: '',
    validator: '',
    errorMessage: ''
  })
}

function removeCustomValidator(index: number) {
  config.value.validation.custom?.splice(index, 1)
}

// Helper functions for JSON handling
function updateHeaders() {
  try {
    if (config.value?.source?.api?.headers) {
      config.value.source.api.headers = JSON.parse(headersText.value)
    }
  } catch (e) {
    // Handle invalid JSON
  }
}

function updateParams() {
  try {
    if (config.value?.source?.database?.params) {
      config.value.source.database.params = JSON.parse(paramsText.value)
    }
  } catch (e) {
    // Handle invalid JSON
  }
}

// Initialize with default values if not provided
if (!config.value) {
  config.value = {
    source: {
      type: 'text',
      text: {
        content: '',
        encoding: 'utf8'
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
    advanced: {
      performance: {
        caching: false,
        cacheTTL: 3600,
        batchSize: 100,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      errorHandling: {
        continueOnError: false,
        logErrors: true,
        errorThreshold: 10
      },
      monitoring: {
        collectMetrics: true,
        logLevel: 'info',
        sampleRate: 1
      }
    }
  }
}

// Add computed properties for type-safe access
// const sourceText = computed(() => config.value?.source?.text)
// const sourceFile = computed(() => config.value?.source?.file)
// const sourceApi = computed(() => config.value?.source?.api)
// const sourceDatabase = computed(() => config.value?.source?.database)
// const sourceStream = computed(() => config.value?.source?.stream)
// const sourceCsv = computed(() => config.value?.source?.csv)
// const columnsText = ref('')

// const preprocessingTokenization = computed(() => config.value?.preprocessing?.tokenization)
// const preprocessingEncoding = computed(() => config.value?.preprocessing?.encoding)
// const validationDataType = computed(() => config.value?.validation?.dataType)
// const validationRange = computed(() => config.value?.validation?.range)

// Add computed property for API authentication
// const sourceApiAuth = computed(() => sourceApi.value?.authentication)

// Add to script section after sourceTypes declaration
// const sensorTypes = [
//   'temperature',
//   'humidity',
//   'pressure',
//   'motion',
//   'light',
//   'custom'
// ]

// Add to computed properties section
// const sourceSensor = computed(() => config.value?.source?.sensor)

// Add helper functions before the existing handleSourceTypeChange function
// function getUnitHint(type: string): string {
//   switch (type) {
//     case 'temperature':
//       return 'e.g., celsius, fahrenheit'
//     case 'humidity':
//       return 'e.g., percent'
//     case 'pressure':
//       return 'e.g., hPa, bar'
//     case 'light':
//       return 'e.g., lux'
//     default:
//       return 'Measurement unit'
//   }
// }

// function getAddressHint(protocol: string): string {
//   switch (protocol) {
//     case 'mqtt':
//       return 'Broker URL (e.g., mqtt://localhost:1883)'
//     case 'http':
//       return 'HTTP endpoint URL'
//     case 'websocket':
//       return 'WebSocket URL'
//     case 'modbus':
//       return 'IP address or serial port'
//     case 'serial':
//       return 'Serial port (e.g., COM1, /dev/ttyUSB0)'
//     default:
//       return 'Connection address'
//   }
// }

// function handleSensorTypeChange(type: string) {
//   if (!sourceSensor.value) return

//   // Set default unit based on sensor type
//   switch (type) {
//     case 'temperature':
//       sourceSensor.value.unit = 'celsius'
//       break
//     case 'humidity':
//       sourceSensor.value.unit = 'percent'
//       break
//     case 'pressure':
//       sourceSensor.value.unit = 'hPa'
//       break
//     case 'light':
//       sourceSensor.value.unit = 'lux'
//       break
//   }
// }

// Update sourceTypes array
// const sourceTypes = ['text', 'file', 'csv', 'api', 'database', 'stream', 'sensor']

// Update handleSourceTypeChange function
// function handleSourceTypeChange(type: string) {
//   const newSource: SourceConfig = { type: type as any }
  
//   switch (type) {
//     case 'text':
//       newSource.text = { content: '', encoding: 'utf8' }
//       break
//     case 'file':
//       newSource.file = { allowedTypes: [], maxSize: 10, concurrent: 1 }
//       break
//     case 'csv':
//       newSource.csv = {
//         delimiter: ',',
//         hasHeader: true,
//         skipRows: 0,
//         encoding: 'utf8',
//         trimFields: true,
//         skipEmptyLines: true,
//         chunkSize: 1000
//       }
//       break
//     case 'api':
//       newSource.api = {
//         endpoint: '',
//         method: 'GET',
//         headers: {},
//         authentication: { type: 'bearer' }
//       }
//       break
//     case 'database':
//       newSource.database = {
//         type: 'postgres',
//         connection: '',
//         query: '',
//         params: {}
//       }
//       break
//     case 'stream':
//       newSource.stream = {
//         type: 'websocket',
//         endpoint: '',
//         topics: [],
//         batchSize: 100
//       }
//       break
//     case 'sensor':
//       newSource.sensor = {
//         type: 'temperature',
//         protocol: 'mqtt',
//         deviceId: '',
//         interval: 1000,
//         unit: 'celsius',
//         range: {
//           min: 0,
//           max: 100
//         },
//         connection: {
//           address: '',
//           settings: {
//             timeout: 5000,
//             retries: 3
//           }
//         },
//         preprocessing: {
//           averaging: false,
//           windowSize: 10,
//           calibration: {
//             offset: 0,
//             scale: 1
//           },
//           thresholds: {
//             low: 0,
//             high: 100
//           },
//           filters: {
//             outliers: false,
//             smoothing: false
//           }
//         }
//       }
//       break
//   }

//   config.value = {
//     ...config.value,
//     source: newSource
//   }
// }

// Update template sections to use computed properties
</script>

<style scoped>
.input-processor-config {
  max-width: 800px;
  margin: 0 auto;
}

.v-expansion-panels {
  margin-bottom: 1rem;
}
</style> 