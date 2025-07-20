<template>
  <div>
    <v-container>
      <!-- Back to Debug Button -->
      <div class="mb-4">
        <v-btn
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-arrow-left"
          @click="goBackToDebug"
        >
          Back to Debug
        </v-btn>
      </div>
      
      <h1 class="mb-4">
        Network Debug
      </h1>
      <v-form @submit.prevent="testNetwork">
        <v-text-field
          v-model="form.endpoint"
          label="Endpoint URL"
          class="mb-3"
          required
        />
        <v-select
          v-model="form.method"
          :items="httpMethods"
          label="HTTP Method"
          class="mb-3"
          required
        />
        <v-textarea
          v-model="form.headers"
          label="Headers (JSON)"
          class="mb-3"
          rows="3"
        />
        <v-textarea
          v-model="form.body"
          label="Request Body (JSON)"
          class="mb-3"
          rows="4"
        />
        <v-text-field
          v-model.number="form.timeout"
          label="Timeout (seconds)"
          type="number"
          min="1"
          max="60"
          class="mb-3"
          required
        />
        <v-btn type="submit" color="primary" :loading="loading">
          Test Network
        </v-btn>
        <v-btn text class="ml-2" @click="resetForm">
          Reset
        </v-btn>
        <v-btn
          color="secondary"
          text
          class="ml-2"
          @click="pingHealth"
        >
          Ping Health Endpoint
        </v-btn>
      </v-form>
      <v-alert v-if="success" type="success" class="mt-4">
        Network test completed successfully!
      </v-alert>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
      <v-card v-if="networkInfo" class="mt-4">
        <v-card-title>Network Information</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>{{ networkInfo.status }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Latency</v-list-item-title>
              <v-list-item-subtitle>{{ networkInfo.latency }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Response Time</v-list-item-title>
              <v-list-item-subtitle>{{ networkInfo.responseTime }}ms</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Last Updated</v-list-item-title>
              <v-list-item-subtitle>{{ networkInfo.lastUpdated }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
      <v-card v-if="testResults" class="mt-4">
        <v-card-title>Test Results</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Status Code</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.statusCode }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Response Time</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.responseTime }}ms</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Response Size</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.responseSize }} bytes</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Response Headers</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.responseHeaders }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const networkInfo = ref<any>(null)
const testResults = ref<any>(null)

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

const form = ref({
  endpoint: 'https://api.cloudless.gr/health',
  method: 'GET',
  headers: '{"Content-Type": "application/json"}',
  body: '',
  timeout: 10,
})

const resetForm = () => {
  form.value = {
    endpoint: 'https://api.cloudless.gr/health',
    method: 'GET',
    headers: '{"Content-Type": "application/json"}',
    body: '',
    timeout: 10,
  }
  success.value = false
  error.value = null
  testResults.value = null
}

const testNetwork = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const startTime = Date.now()
    
    let headers = {}
    try {
      headers = JSON.parse(form.value.headers || '{}')
    } catch (e) {
      headers = { 'Content-Type': 'application/json' }
    }
    
    let body = null
    if (form.value.body && ['POST', 'PUT', 'PATCH'].includes(form.value.method)) {
      try {
        body = JSON.parse(form.value.body)
      } catch (e) {
        body = form.value.body
      }
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), form.value.timeout * 1000)
    
    const response = await fetch(form.value.endpoint, {
      method: form.value.method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    const responseText = await response.text()
    
    testResults.value = {
      statusCode: response.status,
      responseTime,
      responseSize: responseText.length,
      responseHeaders: JSON.stringify(Object.fromEntries(response.headers.entries())),
    }
    
    networkInfo.value = {
      status: response.ok ? 'success' : 'error',
      latency: `${responseTime}ms`,
      responseTime,
      lastUpdated: new Date().toLocaleString(),
    }
    
    success.value = true
  } catch (err: any) {
    error.value = err.name === 'AbortError' ? 'Request timed out' : err.message
    networkInfo.value = {
      status: 'error',
      latency: 'N/A',
      responseTime: 0,
      lastUpdated: new Date().toLocaleString(),
    }
  } finally {
    loading.value = false
  }
}

const pingHealth = async () => {
  form.value.endpoint = 'http://127.0.0.1:54321/health'
  form.value.method = 'GET'
  await testNetwork()
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}
</script>
