<template>
  <DeployGuide />
  <v-container>
    <h1>Deployments</h1>
    <v-alert type="info" class="mb-4">
      This page lists all deployments across your app (models, pipelines, bots, etc). Use it to monitor and manage deployments in one place.
    </v-alert>
    <v-row>
      <v-col cols="12" v-for="deployment in deployments" :key="deployment.id">
        <v-card class="mb-4">
          <v-card-title>
            {{ deployment.name }}
            <v-chip class="ml-2" :color="statusColor(deployment.status)" small>{{ deployment.status }}</v-chip>
          </v-card-title>
          <v-card-subtitle>
            Type: {{ deployment.type }} | Created: {{ formatDate(deployment.created_at) }}
          </v-card-subtitle>
          <v-card-text>
            Endpoint: <code>{{ deployment.endpoint || 'N/A' }}</code>
          </v-card-text>
          <v-card-actions>
            <v-btn text :to="deployment.detailsUrl">View Details</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    <v-alert v-if="deployments.length === 0" type="info">No deployments found.</v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DeployGuide from '~/components/step-guides/DeployGuide.vue'

// Example deployments data. Replace with real API call.
const deployments = ref([
  {
    id: '1',
    name: 'Text Classifier',
    type: 'Model',
    status: 'deployed',
    created_at: new Date().toISOString(),
    endpoint: 'https://api.example.com/model/1',
    detailsUrl: '/models/1'
  },
  {
    id: '2',
    name: 'Data Pipeline',
    type: 'Pipeline',
    status: 'pending',
    created_at: new Date().toISOString(),
    endpoint: '',
    detailsUrl: '/pipelines/2'
  }
])

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function statusColor(status: string) {
  switch (status) {
    case 'deployed': return 'success'
    case 'pending': return 'info'
    case 'failed': return 'error'
    default: return 'default'
  }
}
</script>

<style scoped>
code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
