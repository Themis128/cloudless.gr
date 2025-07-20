<template>
  <v-card class="guide-card">
    <v-card-title class="guide-title">
      <v-icon start color="primary">
        mdi-brain
      </v-icon>
      LLM Management Guide
    </v-card-title>
    <v-card-text class="guide-content">
      <div v-if="page === 'list'" class="guide-section">
        <h4 class="guide-section-title">
          Getting Started
        </h4>
        <p class="guide-text">
          Manage your language models, training sessions, and deployments in one place. 
          Use the quick actions to train new models or view existing deployments.
        </p>
        
        <h4 class="guide-section-title">
          Quick Actions
        </h4>
        <ul class="guide-list">
          <li><strong>Train Model:</strong> Start training a new language model with your data</li>
          <li><strong>View Deployments:</strong> Monitor active model deployments</li>
          <li><strong>Manage Models:</strong> View and manage all your trained models</li>
        </ul>
        
        <h4 class="guide-section-title">
          Tabs Overview
        </h4>
        <ul class="guide-list">
          <li><strong>Models:</strong> View all your trained language models</li>
          <li><strong>Training Sessions:</strong> Monitor ongoing and completed training jobs</li>
          <li><strong>Deployments:</strong> Manage model deployments and endpoints</li>
        </ul>
      </div>
      
      <div v-else-if="page === 'train'" class="guide-section">
        <h4 class="guide-section-title">
          Training Process
        </h4>
        <p class="guide-text">
          Train custom language models with your data. Choose from various base models 
          and training types to suit your specific use case.
        </p>
        
        <h4 class="guide-section-title">
          Configuration
        </h4>
        <ul class="guide-list">
          <li><strong>Base Model:</strong> Select a pre-trained model to fine-tune</li>
          <li><strong>Training Data:</strong> Upload your custom dataset</li>
          <li><strong>Parameters:</strong> Adjust training hyperparameters</li>
        </ul>
        
        <h4 class="guide-section-title">
          Best Practices
        </h4>
        <ul class="guide-list">
          <li>Use high-quality, relevant training data</li>
          <li>Start with smaller datasets for testing</li>
          <li>Monitor training progress regularly</li>
          <li>Use early stopping to prevent overfitting</li>
        </ul>
      </div>
      
      <div v-else-if="page === 'deploy'" class="guide-section">
        <h4 class="guide-section-title">
          Deployment
        </h4>
        <p class="guide-text">
          Deploy your trained models to make them available via API endpoints. 
          Monitor performance and manage deployments efficiently.
        </p>
        
        <h4 class="guide-section-title">
          Deployment Options
        </h4>
        <ul class="guide-list">
          <li><strong>API Endpoint:</strong> RESTful API for model inference</li>
          <li><strong>Batch Processing:</strong> Process large datasets</li>
          <li><strong>Real-time:</strong> Low-latency inference</li>
        </ul>
        
        <h4 class="guide-section-title">
          Monitoring
        </h4>
        <ul class="guide-list">
          <li>Track request latency and throughput</li>
          <li>Monitor model performance metrics</li>
          <li>Set up alerts for issues</li>
          <li>Scale resources as needed</li>
        </ul>
      </div>
      
      <div v-else class="guide-section">
        <h4 class="guide-section-title">
          LLM Management
        </h4>
        <p class="guide-text">
          Language models are the foundation of AI applications. Train, deploy, and 
          manage your models to create powerful AI solutions.
        </p>
        
        <h4 class="guide-section-title">
          Key Features
        </h4>
        <ul class="guide-list">
          <li>Custom model training</li>
          <li>Multiple base model options</li>
          <li>Automated deployment</li>
          <li>Performance monitoring</li>
          <li>Scalable infrastructure</li>
        </ul>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  page?: string
}

withDefaults(defineProps<Props>(), {
  page: 'list'
})
</script>

<style scoped>
.guide-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.guide-title {
  color: var(--v-primary-base);
  font-weight: 600;
  font-size: 1.1rem;
}

.guide-content {
  color: black !important;
}

.guide-section {
  margin-bottom: 1.5rem;
}

.guide-section:last-child {
  margin-bottom: 0;
}

.guide-section-title {
  color: black !important;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.guide-text {
  color: black !important;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.guide-list {
  color: black !important;
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
  padding-left: 1.25rem;
}

.guide-list li {
  margin-bottom: 0.5rem;
  color: black !important;
}

.guide-list li:last-child {
  margin-bottom: 0;
}

.guide-list strong {
  color: black !important;
  font-weight: 600;
}
</style> 