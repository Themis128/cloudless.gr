<template>
  <div class="deploy-page">
    <div class="page-header">
      <h1>Deployments</h1>
      <p class="subtitle">
        Monitor and manage all your deployments in one place
      </p>
    </div>

    <div class="content-container">
      <div class="deploy-content">
        <DeployGuide />
        
        <div class="deployments-section">
          <div class="section-header">
            <h2>Active Deployments</h2>
            <v-alert type="info" class="info-alert">
              This page lists all deployments across your app (models, pipelines, bots, etc). 
              Use it to monitor and manage deployments in one place.
            </v-alert>
          </div>

          <div class="deployments-grid">
            <v-card v-for="deployment in deployments" :key="deployment.id" class="bg-white">
              <v-card-title class="d-flex justify-space-between align-center">
                <span>{{ deployment.name }}</span>
                <v-chip
                  :color="statusColor(deployment.status)"
                  size="small"
                >
                  {{ deployment.status }}
                </v-chip>
              </v-card-title>
              <v-card-text>
                <div class="deployment-meta mb-3">
                  <span class="meta-item d-flex align-center me-4">
                    <v-icon size="16" color="primary" class="me-1">mdi-tag</v-icon>
                    {{ deployment.type }}
                  </span>
                  <span class="meta-item d-flex align-center">
                    <v-icon size="16" color="primary" class="me-1">mdi-calendar</v-icon>
                    {{ formatDate(deployment.created_at) }}
                  </span>
                </div>
                <div class="deployment-endpoint">
                  <strong>Endpoint:</strong> 
                  <code>{{ deployment.endpoint || 'N/A' }}</code>
                </div>
              </v-card-text>
              <v-card-actions>
                <v-btn
                  color="primary"
                  variant="outlined"
                  size="small"
                  :to="deployment.detailsUrl"
                >
                  View Details
                </v-btn>
              </v-card-actions>
            </v-card>
          </div>

          <v-alert v-if="deployments.length === 0" type="info" class="no-deployments">
            No deployments found. Start by creating and deploying your first model, pipeline, or bot.
          </v-alert>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
    detailsUrl: '/models/1',
  },
  {
    id: '2',
    name: 'Data Pipeline',
    type: 'Pipeline',
    status: 'pending',
    created_at: new Date().toISOString(),
    endpoint: '',
    detailsUrl: '/pipelines/2',
  },
])

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}

const statusColor = (status: string) => {
  switch (status) {
    case 'deployed':
      return 'success'
    case 'pending':
      return 'info'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}
</script>

<style scoped>
.deploy-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9) !important;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.9) !important;
  margin: 0;
}

.content-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.deploy-content {
  max-width: 1000px;
  margin: 0 auto;
}

.deployments-section {
  margin-top: 3rem;
}

.section-header {
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.info-alert {
  margin-bottom: 2rem;
}

.deployments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.deployment-meta {
  display: flex;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.7);
}

.deployment-endpoint {
  font-size: 0.9rem;
}

.deployment-endpoint strong {
  color: rgba(0, 0, 0, 0.9);
}

.deployment-endpoint code {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: rgba(0, 0, 0, 0.8);
}

.no-deployments {
  text-align: center;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .deploy-page {
    padding: 1rem;
  }

  .content-container {
    padding: 2rem;
  }

  .deployments-grid {
    grid-template-columns: 1fr;
  }

  .deployment-meta {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
