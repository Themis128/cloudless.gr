<template>
  <div class="api-documentation-page">
    <LayoutPageStructure
      title="API Reference"
      subtitle="Complete API documentation for Cloudless.gr platform"
      :show-back-button="true"
      back-button-to="/documentation"
    >
      <template #main>
        <div class="documentation-content">
          <!-- Quick Navigation -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h6 bg-primary text-white">
              <v-icon class="mr-2">mdi-api</v-icon>
              API Quick Navigation
            </v-card-title>
            <v-card-text class="pa-4">
              <v-row>
                <v-col
                  v-for="section in quickNav"
                  :key="section.id"
                  cols="12"
                  sm="6"
                  md="4"
                >
                  <v-btn
                    :to="section.link"
                    variant="outlined"
                    class="w-100 text-left justify-start"
                    :prepend-icon="section.icon"
                  >
                    {{ section.title }}
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Introduction Section -->
          <div id="introduction" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-information</v-icon>
              API Overview
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-text>
                <p class="text-body-1 mb-4">
                  The Cloudless.gr API provides programmatic access to all platform features including bot management, 
                  model training, pipeline creation, and data analytics. Our RESTful API follows industry standards 
                  and provides comprehensive functionality for integration and automation.
                </p>
                
                <div class="feature-grid">
                  <div
                    v-for="feature in apiFeatures"
                    :key="feature.title"
                    class="feature-item"
                  >
                    <v-icon :color="feature.color" size="32" class="mb-2">
                      {{ feature.icon }}
                    </v-icon>
                    <h4 class="text-h6 mb-2">{{ feature.title }}</h4>
                    <p class="text-body-2">{{ feature.description }}</p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <!-- Authentication Section -->
          <div id="authentication" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-shield-key</v-icon>
              Authentication
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-title class="text-h6">
                <v-icon class="mr-2">mdi-key</v-icon>
                API Keys
              </v-card-title>
              <v-card-text>
                <p class="mb-4">
                  All API requests require authentication using API keys. You can generate API keys from your account dashboard.
                </p>
                
                <v-alert type="info" variant="tonal" class="mb-4">
                  <template #prepend>
                    <v-icon>mdi-lightbulb</v-icon>
                  </template>
                  <strong>Security Note:</strong> Keep your API keys secure and never expose them in client-side code.
                </v-alert>
                
                <h4 class="text-subtitle-1 mb-2">Using API Keys:</h4>
                <v-code class="code-block">
// Include API key in request headers
const headers = {
  'Authorization': 'Bearer YOUR_API_KEY',
  'Content-Type': 'application/json'
}

// Example request
fetch('https://api.cloudless.gr/v1/bots', {
  method: 'GET',
  headers: headers
})
                </v-code>
              </v-card-text>
            </v-card>
          </div>

          <!-- Endpoints Section -->
          <div id="endpoints" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-webhook</v-icon>
              API Endpoints
            </h2>
            
            <v-expansion-panels class="mb-4" multiple>
              <v-expansion-panel
                v-for="endpoint in apiEndpoints"
                :key="endpoint.path"
                :title="endpoint.title"
              >
                <template #title>
                  <div class="d-flex align-center">
                    <v-chip
                      :color="getMethodColor(endpoint.method)"
                      size="small"
                      class="mr-3"
                    >
                      {{ endpoint.method }}
                    </v-chip>
                    <span class="text-h6">{{ endpoint.path }}</span>
                  </div>
                </template>
                
                <template #text>
                  <div class="pa-4">
                    <p class="mb-4">{{ endpoint.description }}</p>
                    
                    <div v-if="endpoint.parameters" class="mb-4">
                      <h4 class="text-subtitle-1 mb-2">Parameters:</h4>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Type</th>
                            <th>Required</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="param in endpoint.parameters"
                            :key="param.name"
                          >
                            <td><code>{{ param.name }}</code></td>
                            <td>{{ param.type }}</td>
                            <td>{{ param.required ? 'Yes' : 'No' }}</td>
                            <td>{{ param.description }}</td>
                          </tr>
                        </tbody>
                      </v-table>
                    </div>
                    
                    <div v-if="endpoint.example" class="mb-4">
                      <h4 class="text-subtitle-1 mb-2">Example Request:</h4>
                      <v-code class="code-block">{{ endpoint.example }}</v-code>
                    </div>
                    
                    <div v-if="endpoint.response" class="mb-4">
                      <h4 class="text-subtitle-1 mb-2">Example Response:</h4>
                      <v-code class="code-block">{{ endpoint.response }}</v-code>
                    </div>
                  </div>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- SDKs Section -->
          <div id="sdks" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-package-variant</v-icon>
              SDKs and Libraries
            </h2>
            
            <v-row>
              <v-col
                v-for="sdk in sdks"
                :key="sdk.name"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card class="h-100" elevation="2">
                  <v-card-title class="text-h6">
                    <v-icon :color="sdk.color" class="mr-2">
                      {{ sdk.icon }}
                    </v-icon>
                    {{ sdk.name }}
                  </v-card-title>
                  <v-card-text>
                    <p class="mb-3">{{ sdk.description }}</p>
                    <div class="sdk-info">
                      <p class="text-caption mb-2">
                        <strong>Version:</strong> {{ sdk.version }}
                      </p>
                      <p class="text-caption mb-2">
                        <strong>License:</strong> {{ sdk.license }}
                      </p>
                    </div>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      :href="sdk.installLink"
                      color="primary"
                      variant="text"
                      size="small"
                    >
                      Install
                    </v-btn>
                    <v-btn
                      :href="sdk.docsLink"
                      color="secondary"
                      variant="text"
                      size="small"
                    >
                      Documentation
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <!-- Rate Limits Section -->
          <div id="rate-limits" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-speedometer</v-icon>
              Rate Limits
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-text>
                <p class="mb-4">
                  To ensure fair usage and system stability, API requests are subject to rate limiting. 
                  Different endpoints have different limits based on their resource intensity.
                </p>
                
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Requests per Minute</th>
                      <th>Requests per Hour</th>
                      <th>Concurrent Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="plan in rateLimits"
                      :key="plan.name"
                    >
                      <td>{{ plan.name }}</td>
                      <td>{{ plan.perMinute }}</td>
                      <td>{{ plan.perHour }}</td>
                      <td>{{ plan.concurrent }}</td>
                    </tr>
                  </tbody>
                </v-table>
                
                <v-alert type="warning" variant="tonal" class="mt-4">
                  <template #prepend>
                    <v-icon>mdi-alert</v-icon>
                  </template>
                  When rate limits are exceeded, requests will return a 429 status code. 
                  Implement exponential backoff for retry logic.
                </v-alert>
              </v-card-text>
            </v-card>
          </div>

          <!-- Error Handling Section -->
          <div id="error-handling" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-alert-circle</v-icon>
              Error Handling
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-text>
                <p class="mb-4">
                  The API uses standard HTTP status codes to indicate the success or failure of requests. 
                  Error responses include detailed information to help with debugging.
                </p>
                
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Status Code</th>
                      <th>Error Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="error in errorCodes"
                      :key="error.code"
                    >
                      <td><code>{{ error.code }}</code></td>
                      <td>{{ error.type }}</td>
                      <td>{{ error.description }}</td>
                    </tr>
                  </tbody>
                </v-table>
                
                <h4 class="text-subtitle-1 mt-4 mb-2">Example Error Response:</h4>
                <v-code class="code-block">
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request parameters",
    "details": {
      "field": "name",
      "issue": "Name is required"
    }
  }
}
                </v-code>
              </v-card-text>
            </v-card>
          </div>

          <!-- Resources Section -->
          <div id="resources" class="section">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-book-open</v-icon>
              Additional Resources
            </h2>
            
            <v-row>
              <v-col
                v-for="resource in resources"
                :key="resource.title"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card class="h-100" elevation="2" :to="resource.link">
                  <v-card-title class="text-h6">
                    <v-icon :color="resource.color" class="mr-2">
                      {{ resource.icon }}
                    </v-icon>
                    {{ resource.title }}
                  </v-card-title>
                  <v-card-text>
                    <p>{{ resource.description }}</p>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      :to="resource.link"
                      color="primary"
                      variant="text"
                    >
                      Learn More
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </div>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import PageStructure from '~/components/layout/PageStructure.vue'

// Set page meta
useHead({
  title: 'API Reference - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Complete API documentation for Cloudless.gr platform. RESTful API for bot management, model training, and data pipelines.' },
    { property: 'og:title', content: 'API Reference - Cloudless.gr' },
    { property: 'og:description', content: 'Comprehensive API documentation for Cloudless.gr platform.' }
  ]
})

// Quick navigation items
const quickNav = [
  { id: 'introduction', title: 'Overview', link: '#introduction', icon: 'mdi-information' },
  { id: 'authentication', title: 'Authentication', link: '#authentication', icon: 'mdi-shield-key' },
  { id: 'endpoints', title: 'Endpoints', link: '#endpoints', icon: 'mdi-webhook' },
  { id: 'sdks', title: 'SDKs', link: '#sdks', icon: 'mdi-package-variant' },
  { id: 'rate-limits', title: 'Rate Limits', link: '#rate-limits', icon: 'mdi-speedometer' },
  { id: 'error-handling', title: 'Error Handling', link: '#error-handling', icon: 'mdi-alert-circle' }
]

// API features
const apiFeatures = [
  {
    title: 'RESTful Design',
    description: 'Standard REST API following industry best practices',
    icon: 'mdi-webhook',
    color: 'primary'
  },
  {
    title: 'JSON Responses',
    description: 'All responses in JSON format for easy integration',
    icon: 'mdi-code-json',
    color: 'secondary'
  },
  {
    title: 'Authentication',
    description: 'Secure API key-based authentication',
    icon: 'mdi-shield-key',
    color: 'success'
  },
  {
    title: 'Rate Limiting',
    description: 'Fair usage policies with clear rate limits',
    icon: 'mdi-speedometer',
    color: 'warning'
  }
]

// API endpoints
const apiEndpoints = [
  {
    method: 'GET',
    path: '/v1/bots',
    title: 'List Bots',
    description: 'Retrieve a list of all bots in your account.',
    parameters: [
      { name: 'page', type: 'integer', required: false, description: 'Page number for pagination' },
      { name: 'limit', type: 'integer', required: false, description: 'Number of items per page' },
      { name: 'status', type: 'string', required: false, description: 'Filter by bot status' }
    ],
    example: `curl -X GET "https://api.cloudless.gr/v1/bots" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    response: `{
  "data": [
    {
      "id": "bot_123",
      "name": "Customer Support Bot",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}`
  },
  {
    method: 'POST',
    path: '/v1/bots',
    title: 'Create Bot',
    description: 'Create a new bot with the specified configuration.',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Bot name' },
      { name: 'prompt', type: 'string', required: true, description: 'Bot prompt/instructions' },
      { name: 'model', type: 'string', required: true, description: 'AI model to use' }
    ],
    example: `curl -X POST "https://api.cloudless.gr/v1/bots" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Bot",
    "prompt": "You are a helpful assistant",
    "model": "gpt-4"
  }'`,
    response: `{
  "data": {
    "id": "bot_456",
    "name": "My Bot",
    "status": "created",
    "created_at": "2024-01-15T11:00:00Z"
  }
}`
  },
  {
    method: 'GET',
    path: '/v1/models',
    title: 'List Models',
    description: 'Retrieve available AI models for training and inference.',
    parameters: [],
    example: `curl -X GET "https://api.cloudless.gr/v1/models" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    response: `{
  "data": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "type": "language_model",
      "capabilities": ["text_generation", "conversation"]
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/v1/pipelines',
    title: 'Create Pipeline',
    description: 'Create a new data processing pipeline.',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Pipeline name' },
      { name: 'config', type: 'object', required: true, description: 'Pipeline configuration' }
    ],
    example: `curl -X POST "https://api.cloudless.gr/v1/pipelines" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Data ETL Pipeline",
    "config": {
      "sources": [...],
      "transformations": [...],
      "outputs": [...]
    }
  }'`,
    response: `{
  "data": {
    "id": "pipeline_789",
    "name": "Data ETL Pipeline",
    "status": "created",
    "created_at": "2024-01-15T12:00:00Z"
  }
}`
  }
]

// SDKs
const sdks = [
  {
    name: 'JavaScript/Node.js',
    description: 'Official SDK for JavaScript and Node.js applications',
    icon: 'mdi-language-javascript',
    color: '#F7DF1E',
    version: '1.2.0',
    license: 'MIT',
    installLink: 'https://npmjs.com/package/@cloudless/sdk',
    docsLink: '/documentation/sdks/javascript'
  },
  {
    name: 'Python',
    description: 'Official SDK for Python applications',
    icon: 'mdi-language-python',
    color: '#3776AB',
    version: '1.1.5',
    license: 'MIT',
    installLink: 'https://pypi.org/project/cloudless-sdk',
    docsLink: '/documentation/sdks/python'
  },
  {
    name: 'Go',
    description: 'Official SDK for Go applications',
    icon: 'mdi-language-go',
    color: '#00ADD8',
    version: '1.0.3',
    license: 'MIT',
    installLink: 'https://github.com/cloudless/sdk-go',
    docsLink: '/documentation/sdks/go'
  }
]

// Rate limits
const rateLimits = [
  {
    name: 'Free',
    perMinute: 60,
    perHour: 1000,
    concurrent: 5
  },
  {
    name: 'Pro',
    perMinute: 300,
    perHour: 10000,
    concurrent: 20
  },
  {
    name: 'Enterprise',
    perMinute: 1000,
    perHour: 50000,
    concurrent: 100
  }
]

// Error codes
const errorCodes = [
  { code: '400', type: 'Bad Request', description: 'Invalid request parameters or body' },
  { code: '401', type: 'Unauthorized', description: 'Invalid or missing API key' },
  { code: '403', type: 'Forbidden', description: 'Insufficient permissions for the resource' },
  { code: '404', type: 'Not Found', description: 'Requested resource not found' },
  { code: '429', type: 'Rate Limited', description: 'Too many requests, rate limit exceeded' },
  { code: '500', type: 'Internal Error', description: 'Server error, please try again later' }
]

// Resources
const resources = [
  {
    title: 'SDK Documentation',
    description: 'Detailed documentation for all SDKs',
    icon: 'mdi-book-open-variant',
    color: 'primary',
    link: '/documentation/sdks'
  },
  {
    title: 'Postman Collection',
    description: 'Ready-to-use Postman collection for testing',
    icon: 'mdi-post',
    color: 'secondary',
    link: '/documentation/postman'
  },
  {
    title: 'Code Examples',
    description: 'Practical examples in multiple languages',
    icon: 'mdi-code-braces',
    color: 'success',
    link: '/documentation/examples'
  },
  {
    title: 'Webhooks Guide',
    description: 'Set up webhooks for real-time notifications',
    icon: 'mdi-webhook',
    color: 'info',
    link: '/documentation/webhooks'
  },
  {
    title: 'API Status',
    description: 'Check API status and uptime',
    icon: 'mdi-heart-pulse',
    color: 'warning',
    link: '/status'
  },
  {
    title: 'Support',
    description: 'Get help with API integration',
    icon: 'mdi-help-circle',
    color: 'error',
    link: '/support'
  }
]

// Helper function
const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'success'
    case 'POST': return 'primary'
    case 'PUT': return 'warning'
    case 'DELETE': return 'error'
    default: return 'grey'
  }
}
</script>

<style scoped>
.api-documentation-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.documentation-content {
  max-width: 1200px;
  margin: 0 auto;
}

.section {
  scroll-margin-top: 80px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.feature-item {
  text-align: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.code-block {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  overflow-x: auto;
  font-size: 0.9rem;
}

.sdk-info {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  
  .code-block {
    font-size: 0.8rem;
  }
}
</style> 