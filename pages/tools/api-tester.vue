<template>
  <v-container class="api-tester-container">
    <div class="text-center mb-8">
      <h1 class="text-h3 font-weight-bold mb-4">API Tester</h1>
      <p class="text-body-1 text-medium-emphasis">
        Test and validate your APIs with a comprehensive testing interface and automated validation.
      </p>
    </div>

    <v-row>
      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4">Request Configuration</v-card-title>
          
          <v-form @submit.prevent="sendRequest">
            <!-- HTTP Method and URL -->
            <v-row class="mb-4">
              <v-col cols="3">
                <v-select
                  v-model="requestConfig.method"
                  :items="httpMethods"
                  variant="outlined"
                  density="compact"
                ></v-select>
              </v-col>
              <v-col cols="9">
                <v-text-field
                  v-model="requestConfig.url"
                  placeholder="https://api.example.com/endpoint"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-link"
                ></v-text-field>
              </v-col>
            </v-row>

            <!-- Headers -->
            <v-expansion-panels class="mb-4">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <div class="d-flex align-center">
                    <v-icon class="mr-2">mdi-format-header-pound</v-icon>
                    Headers ({{ requestConfig.headers.length }})
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div v-for="(header, index) in requestConfig.headers" :key="index" class="mb-3">
                    <v-row>
                      <v-col cols="5">
                        <v-text-field
                          v-model="header.key"
                          placeholder="Header name"
                          variant="outlined"
                          density="compact"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model="header.value"
                          placeholder="Header value"
                          variant="outlined"
                          density="compact"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="1">
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          @click="removeHeader(index)"
                        ></v-btn>
                      </v-col>
                    </v-row>
                  </div>
                  <v-btn
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="addHeader"
                  >
                    Add Header
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Request Body -->
            <v-expansion-panels class="mb-4" v-if="showRequestBody">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <div class="d-flex align-center">
                    <v-icon class="mr-2">mdi-file-document</v-icon>
                    Request Body
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-select
                    v-model="requestConfig.contentType"
                    :items="contentTypes"
                    label="Content Type"
                    variant="outlined"
                    class="mb-3"
                  ></v-select>
                  <v-textarea
                    v-model="requestConfig.body"
                    placeholder="Enter request body..."
                    variant="outlined"
                    rows="8"
                    class="font-family-monospace"
                    auto-grow
                  ></v-textarea>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Send Button -->
            <v-btn
              color="primary"
              size="large"
              block
              :loading="isLoading"
              :disabled="!requestConfig.url"
              @click="sendRequest"
            >
              {{ isLoading ? 'Sending...' : 'Send Request' }}
            </v-btn>
          </v-form>
        </v-card>

        <!-- Request History -->
        <v-card class="mt-4 pa-4">
          <v-card-title class="text-h6 mb-3">Request History</v-card-title>
          <v-list>
            <v-list-item
              v-for="(request, index) in requestHistory"
              :key="index"
              @click="loadRequest(request)"
              class="mb-2"
              variant="outlined"
            >
              <template #prepend>
                <v-icon :color="getStatusColor(request.status)" size="small">
                  {{ getStatusIcon(request.status) }}
                </v-icon>
              </template>
              <v-list-item-title class="text-body-2">
                {{ request.method }} {{ request.url }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ request.timestamp }} - {{ request.status }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-h5">Response</span>
            <div>
              <v-btn
                color="success"
                variant="outlined"
                size="small"
                @click="copyResponse"
                :disabled="!response"
                class="mr-2"
              >
                Copy Response
              </v-btn>
              <v-btn
                color="info"
                variant="outlined"
                size="small"
                @click="exportResponse"
                :disabled="!response"
              >
                Export
              </v-btn>
            </div>
          </v-card-title>
          
          <v-card-text>
            <div v-if="response" class="response-container">
              <!-- Response Status -->
              <v-alert
                :type="getResponseType(response.status)"
                variant="tonal"
                class="mb-4"
              >
                <div class="d-flex align-center justify-space-between">
                  <span class="font-weight-medium">
                    Status: {{ response.status }} {{ response.statusText }}
                  </span>
                  <span class="text-caption">
                    {{ response.duration }}ms
                  </span>
                </div>
              </v-alert>

              <!-- Response Headers -->
              <v-expansion-panels class="mb-4">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center">
                      <v-icon class="mr-2">mdi-format-header-pound</v-icon>
                      Response Headers ({{ Object.keys(response.headers).length }})
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list>
                      <v-list-item
                        v-for="(value, key) in response.headers"
                        :key="key"
                        class="py-1"
                      >
                        <v-list-item-title class="text-body-2 font-weight-medium">
                          {{ key }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          {{ value }}
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <!-- Response Body -->
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="text-subtitle-2">
                  Response Body
                  <v-spacer></v-spacer>
                  <v-chip size="small" variant="tonal">
                    {{ response.size }} bytes
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <v-textarea
                    :model-value="formatResponseBody(response.body)"
                    readonly
                    variant="outlined"
                    rows="15"
                    class="font-family-monospace"
                    bg-color="grey-lighten-4"
                  ></v-textarea>
                </v-card-text>
              </v-card>

              <!-- Validation Results -->
              <v-expansion-panels v-if="validationResults.length > 0">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center">
                      <v-icon class="mr-2">mdi-check-circle</v-icon>
                      Validation Results ({{ validationResults.length }})
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list>
                      <v-list-item
                        v-for="(result, index) in validationResults"
                        :key="index"
                        class="py-1"
                      >
                        <template #prepend>
                          <v-icon :color="result.passed ? 'success' : 'error'" size="small">
                            {{ result.passed ? 'mdi-check' : 'mdi-close' }}
                          </v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">
                          {{ result.name }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          {{ result.description }}
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
            <div v-else class="text-center text-medium-emphasis pa-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-api</v-icon>
              <p>Response will appear here after sending a request...</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Example APIs -->
    <v-row class="mt-8">
      <v-col cols="12">
        <h2 class="text-h4 text-center mb-6">Example APIs</h2>
        <v-row>
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('jsonplaceholder')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-json</v-icon>
                <h4 class="text-h6 mb-2">JSONPlaceholder</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Free fake API for testing and prototyping
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('httpbin')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-4">mdi-web</v-icon>
                <h4 class="text-h6 mb-2">HTTPBin</h4>
                <p class="text-body-2 text-medium-emphasis">
                  HTTP request & response service
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('randomuser')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-4">mdi-account</v-icon>
                <h4 class="text-h6 mb-2">RandomUser</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Generate random user data
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToolsStore } from '~/stores/toolsStore'

definePageMeta({
  title: 'API Tester'
})

// Use tools store
const toolsStore = useToolsStore()

// Reactive state
const isLoading = ref(false)
const response = ref<any>(null)
const validationResults = ref<any[]>([])
const requestHistory = ref<any[]>([])

const requestConfig = ref({
  method: 'GET',
  url: '',
  headers: [
    { key: 'Content-Type', value: 'application/json' }
  ],
  contentType: 'application/json',
  body: ''
})

// Constants
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const contentTypes = [
  'application/json',
  'application/xml',
  'text/plain',
  'application/x-www-form-urlencoded',
  'multipart/form-data'
]

// Computed
const showRequestBody = computed(() => {
  return ['POST', 'PUT', 'PATCH'].includes(requestConfig.value.method)
})

// Examples
const examples = {
  jsonplaceholder: {
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    headers: [
      { key: 'Content-Type', value: 'application/json' }
    ],
    body: ''
  },
  httpbin: {
    method: 'POST',
    url: 'https://httpbin.org/post',
    headers: [
      { key: 'Content-Type', value: 'application/json' }
    ],
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }, null, 2)
  },
  randomuser: {
    method: 'GET',
    url: 'https://randomuser.me/api/?results=3',
    headers: [
      { key: 'Content-Type', value: 'application/json' }
    ],
    body: ''
  }
}

// Methods
const loadExample = (exampleKey: string) => {
  const example = examples[exampleKey as keyof typeof examples]
  requestConfig.value = { ...example }
}

const addHeader = () => {
  requestConfig.value.headers.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  requestConfig.value.headers.splice(index, 1)
}

const sendRequest = async () => {
  if (!requestConfig.value.url) {
    alert('Please enter a URL')
    return
  }

  isLoading.value = true
  response.value = null
  validationResults.value = []

  const startTime = Date.now()

  try {
    // Prepare headers
    const headers: Record<string, string> = {}
    requestConfig.value.headers.forEach(header => {
      if (header.key && header.value) {
        headers[header.key] = header.value
      }
    })

    // Prepare request options
    const options: any = {
      method: requestConfig.value.method,
      headers
    }

    if (showRequestBody.value && requestConfig.value.body) {
      options.body = requestConfig.value.body
    }

    // Send request
    const fetchResponse = await fetch(requestConfig.value.url, options)
    const responseText = await fetchResponse.text()
    
    const duration = Date.now() - startTime

    // Parse response body
    let responseBody
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }

    response.value = {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: Object.fromEntries(fetchResponse.headers.entries()),
      body: responseBody,
      duration,
      size: responseText.length
    }

    // Run validations
    validationResults.value = runValidations(response.value)

    // Add to history
    const historyItem = {
      ...requestConfig.value,
      status: response.value.status,
      timestamp: new Date().toLocaleTimeString(),
      duration
    }
    requestHistory.value.unshift(historyItem)

    // Keep only last 10 requests
    if (requestHistory.value.length > 10) {
      requestHistory.value = requestHistory.value.slice(0, 10)
    }

    // Record tool usage
    toolsStore.recordToolUsage('api-tester', true, duration)
  } catch (error) {
    console.error('Request failed:', error)
    response.value = {
      status: 0,
      statusText: 'Network Error',
      headers: {},
      body: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      size: 0
    }
  } finally {
    isLoading.value = false
  }
}

const loadRequest = (request: any) => {
  requestConfig.value = {
    method: request.method,
    url: request.url,
    headers: request.headers || [],
    contentType: request.contentType || 'application/json',
    body: request.body || ''
  }
}

const copyResponse = async () => {
  if (!response.value) return
  
  try {
    const responseText = JSON.stringify(response.value.body, null, 2)
    await navigator.clipboard.writeText(responseText)
    alert('Response copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
    alert('Failed to copy response')
  }
}

const exportResponse = () => {
  if (!response.value) return
  
  const dataStr = JSON.stringify(response.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'api-response.json'
  link.click()
  URL.revokeObjectURL(url)
}

const formatResponseBody = (body: any) => {
  if (typeof body === 'string') {
    return body
  }
  return JSON.stringify(body, null, 2)
}

const runValidations = (response: any) => {
  const validations = []

  // Status code validation
  validations.push({
    name: 'Status Code',
    description: `Status code is ${response.status}`,
    passed: response.status >= 200 && response.status < 300
  })

  // Response time validation
  validations.push({
    name: 'Response Time',
    description: `Response time is ${response.duration}ms`,
    passed: response.duration < 1000
  })

  // Content-Type validation
  const contentType = response.headers['content-type']
  if (contentType) {
    validations.push({
      name: 'Content-Type',
      description: `Content-Type is ${contentType}`,
      passed: contentType.includes('application/json') || contentType.includes('text/')
    })
  }

  // Response size validation
  validations.push({
    name: 'Response Size',
    description: `Response size is ${response.size} bytes`,
    passed: response.size > 0
  })

  return validations
}

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'info'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'error'
  return 'grey'
}

const getStatusIcon = (status: number) => {
  if (status >= 200 && status < 300) return 'mdi-check-circle'
  if (status >= 300 && status < 400) return 'mdi-information'
  if (status >= 400 && status < 500) return 'mdi-alert'
  if (status >= 500) return 'mdi-alert-circle'
  return 'mdi-help-circle'
}

const getResponseType = (status: number) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'info'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'error'
  return 'info'
}

// Record tool usage on mount
onMounted(() => {
  toolsStore.recordToolUsage('api-tester')
})
</script>

<style scoped>
.api-tester-container {
  max-width: 1200px;
  margin: 0 auto;
}

.example-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.example-card:hover {
  transform: translateY(-2px);
}

.font-family-monospace {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.response-container {
  max-height: 600px;
  overflow-y: auto;
}
</style> 