<template>
  <div class="api-playground-container">
    <div class="header">
      <h1>API Playground</h1>
      <p>Test and explore our API endpoints with real-time requests and responses.</p>
    </div>

    <div class="main-content">
      <div class="sidebar">
        <div class="endpoint-list">
          <h3>Available Endpoints</h3>
          <div 
            v-for="endpoint in endpoints" 
            :key="endpoint.path"
            @click="selectEndpoint(endpoint)"
            :class="['endpoint-item', { active: selectedEndpoint?.path === endpoint.path }]"
          >
            <div class="endpoint-method" :class="endpoint.method.toLowerCase()">
              {{ endpoint.method }}
            </div>
            <div class="endpoint-info">
              <div class="endpoint-path">{{ endpoint.path }}</div>
              <div class="endpoint-description">{{ endpoint.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="playground-area">
        <div class="request-section">
          <div class="request-header">
            <h3>Request</h3>
            <div class="request-controls">
              <button @click="sendRequest" :disabled="isLoading" class="send-btn">
                {{ isLoading ? 'Sending...' : 'Send Request' }}
              </button>
            </div>
          </div>

          <div v-if="selectedEndpoint" class="request-details">
            <div class="url-display">
              <span class="method-badge" :class="selectedEndpoint.method.toLowerCase()">
                {{ selectedEndpoint.method }}
              </span>
              <span class="url">{{ baseUrl }}{{ selectedEndpoint.path }}</span>
            </div>

            <div v-if="selectedEndpoint.method !== 'GET'" class="request-body">
              <label>Request Body (JSON)</label>
              <textarea
                v-model="requestBody"
                placeholder="Enter JSON request body..."
                rows="8"
                class="body-textarea"
              ></textarea>
            </div>

            <div class="request-headers">
              <label>Headers</label>
              <div class="headers-list">
                <div 
                  v-for="(header, index) in requestHeaders" 
                  :key="index"
                  class="header-row"
                >
                  <input 
                    v-model="header.key" 
                    placeholder="Header name"
                    class="header-input"
                  />
                  <input 
                    v-model="header.value" 
                    placeholder="Header value"
                    class="header-input"
                  />
                  <button @click="removeHeader(index)" class="remove-btn">×</button>
                </div>
                <button @click="addHeader" class="add-header-btn">+ Add Header</button>
              </div>
            </div>
          </div>
        </div>

        <div class="response-section">
          <div class="response-header">
            <h3>Response</h3>
            <div class="response-controls">
              <button @click="clearResponse" class="clear-btn">Clear</button>
              <button @click="copyResponse" class="copy-btn">Copy</button>
            </div>
          </div>

          <div v-if="response" class="response-content">
            <div class="response-status">
              <span class="status-code" :class="getStatusClass(response.status)">
                {{ response.status }}
              </span>
              <span class="response-time">{{ response.time }}ms</span>
            </div>

            <div class="response-headers">
              <h4>Response Headers</h4>
              <pre class="headers-display">{{ formatHeaders(response.headers) }}</pre>
            </div>

            <div class="response-body">
              <h4>Response Body</h4>
              <pre class="body-display">{{ formatResponse(response.data) }}</pre>
            </div>
          </div>

          <div v-else class="response-placeholder">
            <p>Send a request to see the response here...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Endpoint {
  path: string
  method: string
  description: string
}

interface Response {
  status: number
  statusText: string
  headers: Record<string, string>
  data: string
  time: number
}

interface RequestHeader {
  key: string
  value: string
}

const baseUrl = ref('http://localhost:3000')
const selectedEndpoint = ref<Endpoint | null>(null)
const requestBody = ref('')
const requestHeaders = ref<RequestHeader[]>([
  { key: 'Content-Type', value: 'application/json' }
])
const response = ref<Response | null>(null)
const isLoading = ref(false)

const endpoints = ref<Endpoint[]>([
  {
    path: '/api/projects',
    method: 'GET',
    description: 'Get all projects with optional filtering and pagination'
  },
  {
    path: '/api/projects',
    method: 'POST',
    description: 'Create a new project'
  },
  {
    path: '/api/projects/[slug]',
    method: 'GET',
    description: 'Get a specific project by slug'
  },
  {
    path: '/api/auth/user',
    method: 'POST',
    description: 'User authentication (login/signup)'
  },
  {
    path: '/api/admin/users',
    method: 'GET',
    description: 'Get all users (admin only)'
  },
  {
    path: '/api/contact-submissions',
    method: 'GET',
    description: 'Get contact form submissions (admin only)'
  }
])

const selectEndpoint = (endpoint: Endpoint) => {
  selectedEndpoint.value = endpoint
  response.value = null
  
  // Set default request body for certain endpoints
  if (endpoint.path === '/api/auth/user') {
    requestBody.value = JSON.stringify({
      action: 'login',
      email: 'demo@example.com',
      password: 'password'
    }, null, 2)
  } else if (endpoint.path === '/api/projects' && endpoint.method === 'POST') {
    requestBody.value = JSON.stringify({
      project_name: 'Sample Project',
      slug: 'sample-project',
      overview: 'A sample project description',
      description: 'Detailed project description...',
      category: 'web-development',
      status: 'draft'
    }, null, 2)
  } else {
    requestBody.value = ''
  }
}

const addHeader = () => {
  requestHeaders.value.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  requestHeaders.value.splice(index, 1)
}

const sendRequest = async () => {
  if (!selectedEndpoint.value) return

  isLoading.value = true
  const startTime = Date.now()

  try {
    const headers: Record<string, string> = {}
    requestHeaders.value.forEach(header => {
      if (header.key && header.value) {
        headers[header.key] = header.value
      }
    })

    const url = selectedEndpoint.value.path.includes('[slug]') 
      ? `${baseUrl.value}/api/projects/sample-project`
      : `${baseUrl.value}${selectedEndpoint.value.path}`

    const options: RequestInit = {
      method: selectedEndpoint.value.method,
      headers
    }

    if (requestBody.value && selectedEndpoint.value.method !== 'GET') {
      options.body = requestBody.value
    }

    const fetchResponse = await fetch(url, options)
    const data = await fetchResponse.text()
    
    const endTime = Date.now()
    const responseTime = endTime - startTime

    response.value = {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: Object.fromEntries(fetchResponse.headers.entries()),
      data: data,
      time: responseTime
    }
  } catch (error: any) {
    const endTime = Date.now()
    const responseTime = endTime - startTime

    response.value = {
      status: 0,
      statusText: 'Network Error',
      headers: {},
      data: error.message || 'Unknown error',
      time: responseTime
    }
  } finally {
    isLoading.value = false
  }
}

const clearResponse = () => {
  response.value = null
}

const copyResponse = async () => {
  if (!response.value) return

  try {
    const responseText = JSON.stringify(response.value, null, 2)
    await navigator.clipboard.writeText(responseText)
    alert('Response copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy response:', error)
    alert('Failed to copy response')
  }
}

const getStatusClass = (status: number) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400 && status < 500) return 'client-error'
  if (status >= 500) return 'server-error'
  return 'info'
}

const formatHeaders = (headers: Record<string, string>) => {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

const formatResponse = (data: string) => {
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}
</script>

<style scoped>
.api-playground-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.header p {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.main-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  height: calc(100vh - 200px);
}

.sidebar {
  background: #f8fafc;
  border-radius: 0.5rem;
  padding: 1.5rem;
  overflow-y: auto;
}

.endpoint-list h3 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1.125rem;
}

.endpoint-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.endpoint-item:hover {
  background: #e2e8f0;
}

.endpoint-item.active {
  background: #dbeafe;
  border: 1px solid #1e40af;
}

.endpoint-method {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  min-width: 3rem;
  text-align: center;
}

.endpoint-method.get {
  background: #dcfce7;
  color: #166534;
}

.endpoint-method.post {
  background: #dbeafe;
  color: #1e40af;
}

.endpoint-method.put {
  background: #fef3c7;
  color: #92400e;
}

.endpoint-method.delete {
  background: #fee2e2;
  color: #991b1b;
}

.endpoint-info {
  flex: 1;
}

.endpoint-path {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: #374151;
  margin-bottom: 0.25rem;
}

.endpoint-description {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.4;
}

.playground-area {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.request-section,
.response-section {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.request-header,
.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
}

.request-header h3,
.response-header h3 {
  margin: 0;
  color: #374151;
}

.request-controls,
.response-controls {
  display: flex;
  gap: 0.5rem;
}

.send-btn {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #059669;
}

.send-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.clear-btn,
.copy-btn {
  padding: 0.5rem 1rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-btn:hover,
.copy-btn:hover {
  background: #4b5563;
}

.request-details {
  padding: 1.5rem;
}

.url-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.375rem;
}

.method-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.method-badge.get {
  background: #dcfce7;
  color: #166534;
}

.method-badge.post {
  background: #dbeafe;
  color: #1e40af;
}

.method-badge.put {
  background: #fef3c7;
  color: #92400e;
}

.method-badge.delete {
  background: #fee2e2;
  color: #991b1b;
}

.url {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: #374151;
}

.request-body,
.request-headers {
  margin-bottom: 1.5rem;
}

.request-body label,
.request-headers label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.body-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
}

.body-textarea:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.headers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.header-input {
  flex: 1;
  padding: 0.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.header-input:focus {
  outline: none;
  border-color: #1e40af;
}

.remove-btn {
  padding: 0.25rem 0.5rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.remove-btn:hover {
  background: #dc2626;
}

.add-header-btn {
  padding: 0.5rem;
  background: #f3f4f6;
  color: #374151;
  border: 2px dashed #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.add-header-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.response-content {
  padding: 1.5rem;
}

.response-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.375rem;
}

.status-code {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.status-code.success {
  background: #dcfce7;
  color: #166534;
}

.status-code.client-error {
  background: #fee2e2;
  color: #991b1b;
}

.status-code.server-error {
  background: #fef3c7;
  color: #92400e;
}

.status-code.info {
  background: #dbeafe;
  color: #1e40af;
}

.response-time {
  font-size: 0.875rem;
  color: #64748b;
}

.response-headers,
.response-body {
  margin-bottom: 1.5rem;
}

.response-headers h4,
.response-body h4 {
  margin: 0 0 0.75rem 0;
  color: #374151;
  font-size: 1rem;
}

.headers-display,
.body-display {
  background: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 0.375rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.response-placeholder {
  padding: 3rem 1.5rem;
  text-align: center;
  color: #9ca3af;
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
    height: auto;
  }
  
  .sidebar {
    order: 2;
  }
  
  .playground-area {
    order: 1;
  }
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }
  
  .url-display {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .header-row {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style> 