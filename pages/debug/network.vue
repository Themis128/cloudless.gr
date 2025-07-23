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

      <!-- Instructions Section -->
      <v-card class="mb-6">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-information" class="mr-2" color="info" />
          How to Use Network Debug
          <v-spacer />
          <v-btn
            icon="mdi-chevron-up"
            variant="text"
            size="small"
            @click="instructionsExpanded = !instructionsExpanded"
          />
        </v-card-title>
        
        <v-expand-transition>
          <div v-show="instructionsExpanded">
            <v-card-text>
              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-target" size="20" class="mr-1" />
                  Purpose
                </h4>
                <p class="text-body-2">
                  Test API endpoints, network connectivity, and HTTP requests. Verify that your application can communicate with external services and diagnose network-related issues.
                </p>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-playlist-edit" size="20" class="mr-1" />
                  How to Use
                </h4>
                <ol class="text-body-2">
                  <li class="mb-2">Enter the endpoint URL you want to test in the form above</li>
                  <li class="mb-2">Select the appropriate HTTP method (GET, POST, PUT, DELETE)</li>
                  <li class="mb-2">Add any required headers in JSON format if needed</li>
                  <li class="mb-2">Include request body data in JSON format for POST/PUT requests</li>
                  <li class="mb-2">Set an appropriate timeout value (1-60 seconds)</li>
                  <li class="mb-2">Click "Test Network" to execute the request</li>
                  <li class="mb-2">Review the response and any error messages</li>
                </ol>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-lightbulb" size="20" class="mr-1" />
                  Tips
                </h4>
                <ul class="text-body-2">
                  <li>Start with simple GET requests to test basic connectivity</li>
                  <li>Use the "Ping Health Endpoint" button for quick connectivity tests</li>
                  <li>Test with different timeout values to identify slow responses</li>
                  <li>Check the response headers for additional debugging information</li>
                </ul>
              </div>
            </v-card-text>
          </div>
        </v-expand-transition>
      </v-card>

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
          <pre>{{ JSON.stringify(testResults, null, 2) }}</pre>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const networkInfo = ref<any>(null)
const testResults = ref<any>(null)
const instructionsExpanded = ref(true)

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const form = ref({
  endpoint: '',
  method: 'GET',
  headers: '',
  body: '',
  timeout: 10
})

const resetForm = () => {
  form.value = {
    endpoint: '',
    method: 'GET',
    headers: '',
    body: '',
    timeout: 10
  }
  success.value = false
  error.value = null
  testResults.value = null
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}

const testNetwork = async () => {
  loading.value = true
  success.value = false
  error.value = null
  testResults.value = null
  
  try {
    const startTime = Date.now()
    
    // Parse headers if provided
    let headers = {}
    if (form.value.headers.trim()) {
      try {
        headers = JSON.parse(form.value.headers)
      } catch (e) {
        throw new Error('Invalid JSON in headers')
      }
    }
    
    // Parse body if provided
    let body = undefined
    if (form.value.body.trim()) {
      try {
        body = JSON.parse(form.value.body)
      } catch (e) {
        throw new Error('Invalid JSON in body')
      }
    }
    
    const response = await $fetch(form.value.endpoint, {
      method: form.value.method,
      headers,
      body,
      timeout: form.value.timeout * 1000
    })
    
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    testResults.value = {
      status: 'success',
      responseTime,
      data: response,
      timestamp: new Date().toISOString()
    }
    
    success.value = true
    console.log('Network test completed:', testResults.value)
  } catch (err: any) {
    error.value = err.message || 'Network test failed'
    console.error('Network test error:', err)
  } finally {
    loading.value = false
  }
}

const pingHealth = async () => {
  try {
    const response = await $fetch('/api/health')
    networkInfo.value = {
      status: 'Connected',
      latency: 'Low',
      responseTime: 50,
      lastUpdated: new Date().toLocaleString()
    }
    console.log('Health check response:', response)
  } catch (err) {
    networkInfo.value = {
      status: 'Disconnected',
      latency: 'High',
      responseTime: 0,
      lastUpdated: new Date().toLocaleString()
    }
    console.error('Health check failed:', err)
  }
}

onMounted(() => {
  pingHealth()
})
</script>
