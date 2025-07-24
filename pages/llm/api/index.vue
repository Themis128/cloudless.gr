<template>
  <div>
    <LayoutPageStructure
      title="API Documentation"
      subtitle="Integrate with your LLM models via REST API"
      back-button-to="/llm"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- API Overview -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-api
            </v-icon>
            API Overview
          </v-card-title>
          <v-card-text>
            <p class="mb-4">
              Our LLM API provides RESTful endpoints for interacting with your trained models. 
              All requests should be made to the base URL: <code class="bg-grey-lighten-3 px-2 py-1 rounded">https://api.cloudless.gr/v1</code>
            </p>
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <strong>Base URL:</strong> https://api.cloudless.gr/v1<br>
              <strong>Content-Type:</strong> application/json<br>
              <strong>Authentication:</strong> Bearer token required
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Authentication -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-shield-key
            </v-icon>
            Authentication
          </v-card-title>
          <v-card-text>
            <p class="mb-4">
              All API requests require authentication using a Bearer token. Include your API key in the Authorization header.
            </p>
            <v-code-block
              :code="authExample"
              language="bash"
              class="mb-4"
            />
            <v-alert
              type="warning"
              variant="tonal"
            >
              <strong>Security Note:</strong> Keep your API keys secure and never expose them in client-side code.
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Endpoints -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-link-variant
            </v-icon>
            Available Endpoints
          </v-card-title>
          <v-card-text>
            <v-expansion-panels>
              <v-expansion-panel
                v-for="endpoint in endpoints"
                :key="endpoint.path"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center">
                    <v-chip
                      :color="getMethodColor(endpoint.method)"
                      size="small"
                      variant="tonal"
                      class="mr-3"
                    >
                      {{ endpoint.method }}
                    </v-chip>
                    <code class="text-body-1">{{ endpoint.path }}</code>
                    <v-spacer />
                    <span class="text-caption text-medium-emphasis">
                      {{ endpoint.description }}
                    </span>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="mb-4">
                    <strong>Description:</strong> {{ endpoint.description }}
                  </div>
                  <div class="mb-4">
                    <strong>Parameters:</strong>
                    <v-list density="compact" class="mt-2">
                      <v-list-item
                        v-for="param in endpoint.parameters"
                        :key="param.name"
                        class="px-0"
                      >
                        <template #prepend>
                          <v-chip
                            :color="param.required ? 'error' : 'grey'"
                            size="x-small"
                            variant="tonal"
                          >
                            {{ param.required ? 'Required' : 'Optional' }}
                          </v-chip>
                        </template>
                        <v-list-item-title>
                          <code>{{ param.name }}</code> ({{ param.type }})
                        </v-list-item-title>
                        <v-list-item-subtitle>
                          {{ param.description }}
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </div>
                  <div class="mb-4">
                    <strong>Example Request:</strong>
                    <v-code-block
                      :code="endpoint.example"
                      :language="endpoint.language"
                      class="mt-2"
                    />
                  </div>
                  <div v-if="endpoint.response">
                    <strong>Example Response:</strong>
                    <v-code-block
                      :code="endpoint.response"
                      language="json"
                      class="mt-2"
                    />
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>

        <!-- Code Examples -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-code-tags
            </v-icon>
            Code Examples
          </v-card-title>
          <v-card-text>
            <v-tabs v-model="activeTab" color="primary">
              <v-tab value="javascript">
                <v-icon start>
                  mdi-language-javascript
                </v-icon>
                JavaScript
              </v-tab>
              <v-tab value="python">
                <v-icon start>
                  mdi-language-python
                </v-icon>
                Python
              </v-tab>
              <v-tab value="curl">
                <v-icon start>
                  mdi-console
                </v-icon>
                cURL
              </v-tab>
            </v-tabs>

            <v-window v-model="activeTab" class="mt-4">
              <v-window-item value="javascript">
                <v-code-block
                  :code="javascriptExample"
                  language="javascript"
                />
              </v-window-item>

              <v-window-item value="python">
                <v-code-block
                  :code="pythonExample"
                  language="python"
                />
              </v-window-item>

              <v-window-item value="curl">
                <v-code-block
                  :code="curlExample"
                  language="bash"
                />
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>

        <!-- Rate Limits -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-speedometer
            </v-icon>
            Rate Limits
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <div class="mb-4">
                  <strong>Free Tier:</strong>
                  <ul class="mt-2">
                    <li>100 requests per hour</li>
                    <li>1 concurrent request</li>
                    <li>Basic models only</li>
                  </ul>
                </div>
                <div class="mb-4">
                  <strong>Pro Tier:</strong>
                  <ul class="mt-2">
                    <li>1,000 requests per hour</li>
                    <li>5 concurrent requests</li>
                    <li>All models available</li>
                  </ul>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="mb-4">
                  <strong>Enterprise Tier:</strong>
                  <ul class="mt-2">
                    <li>10,000 requests per hour</li>
                    <li>Unlimited concurrent requests</li>
                    <li>Custom models and support</li>
                  </ul>
                </div>
                <v-alert
                  type="info"
                  variant="tonal"
                >
                  Rate limit headers are included in all responses:
                  <code class="d-block mt-2">X-RateLimit-Remaining: 95</code>
                  <code class="d-block">X-RateLimit-Reset: 1640995200</code>
                </v-alert>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Error Codes -->
        <v-card>
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-alert-circle
            </v-icon>
            Error Codes
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="errorHeaders"
              :items="errorCodes"
              class="elevation-0"
            >
              <template #item.code="{ item }">
                <v-chip
                  :color="getErrorColor(item.code)"
                  size="small"
                  variant="tonal"
                >
                  {{ item.code }}
                </v-chip>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <LLMGuide page="api" />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const activeTab = ref('javascript')

const authExample = `curl -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     https://api.cloudless.gr/v1/models`

const endpoints = [
  {
    method: 'GET',
    path: '/models',
    description: 'List all available models',
    parameters: [],
    example: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
     https://api.cloudless.gr/v1/models`,
    language: 'bash',
    response: `{
  "models": [
    {
      "id": "gpt-4-finetuned",
      "name": "GPT-4 Fine-tuned",
      "type": "text-generation",
      "status": "ready"
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/generate',
    description: 'Generate text using a model',
    parameters: [
      { name: 'model', type: 'string', required: true, description: 'Model ID to use' },
      { name: 'prompt', type: 'string', required: true, description: 'Input text prompt' },
      { name: 'max_tokens', type: 'integer', required: false, description: 'Maximum tokens to generate' },
      { name: 'temperature', type: 'float', required: false, description: 'Sampling temperature (0-2)' }
    ],
    example: `curl -X POST \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{
       "model": "gpt-4-finetuned",
       "prompt": "Hello, how are you?",
       "max_tokens": 100,
       "temperature": 0.7
     }' \\
     https://api.cloudless.gr/v1/generate`,
    language: 'bash',
    response: `{
  "id": "gen_123",
  "model": "gpt-4-finetuned",
  "text": "Hello! I'm doing well, thank you for asking. How can I help you today?",
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 15,
    "total_tokens": 20
  }
}`
  },
  {
    method: 'POST',
    path: '/classify',
    description: 'Classify text using a classification model',
    parameters: [
      { name: 'model', type: 'string', required: true, description: 'Model ID to use' },
      { name: 'text', type: 'string', required: true, description: 'Text to classify' }
    ],
    example: `curl -X POST \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{
       "model": "bert-classification",
       "text": "This product is amazing!"
     }' \\
     https://api.cloudless.gr/v1/classify`,
    language: 'bash',
    response: `{
  "id": "cls_456",
  "model": "bert-classification",
  "classification": "positive",
  "confidence": 0.95,
  "scores": {
    "positive": 0.95,
    "negative": 0.03,
    "neutral": 0.02
  }
}`
  }
]

const javascriptExample = `// Using fetch API
const response = await fetch('https://api.cloudless.gr/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4-finetuned',
    prompt: 'Hello, how are you?',
    max_tokens: 100,
    temperature: 0.7
  })
});

const data = await response.json();
        // API response received

// Using axios
const axios = require('axios');

const response = await axios.post('https://api.cloudless.gr/v1/generate', {
  model: 'gpt-4-finetuned',
  prompt: 'Hello, how are you?',
  max_tokens: 100,
  temperature: 0.7
}, {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

        // API response received`

const pythonExample = `import requests
import json

# Using requests library
url = 'https://api.cloudless.gr/v1/generate'
headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}
data = {
    'model': 'gpt-4-finetuned',
    'prompt': 'Hello, how are you?',
    'max_tokens': 100,
    'temperature': 0.7
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result['text'])

# Using openai library (if compatible)
import openai

openai.api_key = 'YOUR_API_KEY'
openai.api_base = 'https://api.cloudless.gr/v1'

response = openai.Completion.create(
    model='gpt-4-finetuned',
    prompt='Hello, how are you?',
    max_tokens=100,
    temperature=0.7
)

print(response.choices[0].text)`

const curlExample = `# List models
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     https://api.cloudless.gr/v1/models

# Generate text
curl -X POST \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{
       "model": "gpt-4-finetuned",
       "prompt": "Hello, how are you?",
       "max_tokens": 100,
       "temperature": 0.7
     }' \\
     https://api.cloudless.gr/v1/generate

# Classify text
curl -X POST \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{
       "model": "bert-classification",
       "text": "This product is amazing!"
     }' \\
     https://api.cloudless.gr/v1/classify`

const errorHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Message', key: 'message', sortable: true },
  { title: 'Description', key: 'description', sortable: true }
]

const errorCodes = [
  { code: 400, message: 'Bad Request', description: 'Invalid request parameters' },
  { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
  { code: 403, message: 'Forbidden', description: 'Insufficient permissions' },
  { code: 404, message: 'Not Found', description: 'Model or endpoint not found' },
  { code: 429, message: 'Too Many Requests', description: 'Rate limit exceeded' },
  { code: 500, message: 'Internal Server Error', description: 'Server error occurred' },
  { code: 503, message: 'Service Unavailable', description: 'Model temporarily unavailable' }
]

const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'success'
    case 'POST': return 'primary'
    case 'PUT': return 'warning'
    case 'DELETE': return 'error'
    default: return 'grey'
  }
}

const getErrorColor = (code: number) => {
  if (code >= 500) return 'error'
  if (code >= 400) return 'warning'
  if (code >= 300) return 'info'
  return 'success'
}
</script>

<style scoped>
/* Ensure all text is black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.v-expansion-panel-title) {
  color: black !important;
}

:deep(.v-tab) {
  color: black !important;
}

:deep(.v-tab--selected) {
  color: black !important;
}

:deep(.v-chip) {
  color: black !important;
}

:deep(.v-list-item-title) {
  color: black !important;
}

:deep(.v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-data-table) {
  color: black !important;
}

:deep(.v-data-table th) {
  color: black !important;
}

:deep(.v-data-table td) {
  color: black !important;
}

:deep(.v-alert) {
  color: black !important;
}

code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background-color: #f5f5f5;
  padding: 2px 4px;
  border-radius: 4px;
}
</style> 