<template>
  <div class="model-guides">
    <!-- Models List Guide -->
    <v-card v-if="currentPage === 'list'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-help-circle
        </v-icon>
        Models List Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>How to use the Models List:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📋 Model Cards
          </h4>
          <ul class="guide-list">
            <li><strong>Model Avatar:</strong> Shows model type icon (brain, chart, etc.)</li>
            <li><strong>Model Name:</strong> Click to view detailed information</li>
            <li><strong>Status Chip:</strong> Shows current state (draft, training, ready, deployed)</li>
            <li><strong>Metadata:</strong> Type, creation date, and version information</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Action Menu (⋮)
          </h4>
          <ul class="guide-list">
            <li><strong>👁️ View Details:</strong> Opens comprehensive model information page</li>
            <li><strong>✏️ Edit Model:</strong> Navigate to edit configuration and settings</li>
            <li><strong>🚀 Deploy:</strong> Deploy ready models to production (only for 'ready' status)</li>
            <li><strong>🎓 Train:</strong> Start training for draft models (only for 'draft' status)</li>
            <li><strong>🗑️ Delete:</strong> Remove model with confirmation dialog</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Search & Filter
          </h4>
          <ul class="guide-list">
            <li><strong>Search Bar:</strong> Filter by name, type, or description</li>
            <li><strong>Status Filtering:</strong> Cards show different colors based on status</li>
            <li><strong>Quick Actions:</strong> Use top buttons for common tasks</li>
          </ul>
        </div>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Hover over model cards to see enhanced styling and use the action menu for quick access to all model operations.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Model Details Guide -->
    <v-card v-if="currentPage === 'details'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-information
        </v-icon>
        Model Details Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Understanding Model Details:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Overview Card
          </h4>
          <ul class="guide-list">
            <li><strong>Model Header:</strong> Name, status, version, and quick action buttons</li>
            <li><strong>Description:</strong> Detailed explanation of model purpose</li>
            <li><strong>Metadata Grid:</strong> Type, framework, creation date, and status</li>
            <li><strong>Action Buttons:</strong> Edit, Deploy, or Train based on current status</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Configuration Section
          </h4>
          <ul class="guide-list">
            <li><strong>JSON Display:</strong> View model configuration in formatted JSON</li>
            <li><strong>Parameters:</strong> Learning rate, batch size, epochs, etc.</li>
            <li><strong>Architecture:</strong> Model structure and design details</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📈 Performance Metrics
          </h4>
          <ul class="guide-list">
            <li><strong>Metric Cards:</strong> Visual display of accuracy, loss, etc.</li>
            <li><strong>Grid Layout:</strong> Responsive cards showing key performance indicators</li>
            <li><strong>Real-time Data:</strong> Updated metrics from training sessions</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📅 Model History
          </h4>
          <ul class="guide-list">
            <li><strong>Timeline View:</strong> Chronological events in model lifecycle</li>
            <li><strong>Event Types:</strong> Created, trained, deployed, updated, errors</li>
            <li><strong>Color Coding:</strong> Different colors for different event types</li>
            <li><strong>Timestamps:</strong> Exact dates and times for each event</li>
          </ul>
        </div>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the sidebar quick actions for immediate access to common operations without scrolling through the main content.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Model Edit Guide -->
    <v-card v-if="currentPage === 'edit'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-pencil
        </v-icon>
        Model Edit Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>How to Edit Your Model:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📝 Basic Information
          </h4>
          <ul class="guide-list">
            <li><strong>Model Name:</strong> Required field - choose a descriptive name</li>
            <li><strong>Model Type:</strong> Select from Classification, Regression, Neural Network, etc.</li>
            <li><strong>Description:</strong> Explain model purpose and capabilities</li>
            <li><strong>Version:</strong> Semantic versioning (e.g., 1.0.0, 1.1.0)</li>
            <li><strong>Framework:</strong> Specify TensorFlow, PyTorch, or other framework</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🧠 Model Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Learning Rate:</strong> Step size for optimization (typically 0.001-0.1)</li>
            <li><strong>Batch Size:</strong> Number of samples per training batch (16, 32, 64, etc.)</li>
            <li><strong>Epochs:</strong> Number of complete training cycles (50-1000+)</li>
            <li><strong>Validation Split:</strong> Percentage of data for validation (0.1-0.3)</li>
            <li><strong>Architecture:</strong> Describe model layers and structure</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎓 Training Settings
          </h4>
          <ul class="guide-list">
            <li><strong>Optimizer:</strong> Choose Adam, SGD, RMSprop, etc.</li>
            <li><strong>Loss Function:</strong> Select appropriate loss for your task</li>
            <li><strong>Early Stopping:</strong> Stop training when validation loss plateaus</li>
            <li><strong>Data Augmentation:</strong> Apply transformations to increase dataset</li>
            <li><strong>Preprocessing:</strong> Describe data cleaning and normalization steps</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🚀 Deployment Settings
          </h4>
          <ul class="guide-list">
            <li><strong>Instance Type:</strong> AWS instance type (t3.medium, g4dn.x-large, etc.)</li>
            <li><strong>Replicas:</strong> Number of model instances for load balancing</li>
            <li><strong>Timeout:</strong> Request timeout in seconds</li>
            <li><strong>Max Concurrent:</strong> Maximum simultaneous requests</li>
            <li><strong>Environment Variables:</strong> Key-value pairs for configuration</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Important:</strong> Changes to configuration may require retraining the model. Save your changes before proceeding to training.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the form validation to ensure all required fields are filled. The save button will be disabled until the form is valid.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Model Create Guide -->
    <v-card v-if="currentPage === 'create'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-plus-circle
        </v-icon>
        Model Creation Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Creating Your First Model:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Getting Started
          </h4>
          <ul class="guide-list">
            <li><strong>Choose Model Type:</strong> Select based on your task (Classification, Regression, etc.)</li>
            <li><strong>Plan Architecture:</strong> Design your model structure before creating</li>
            <li><strong>Prepare Data:</strong> Ensure your dataset is ready for training</li>
            <li><strong>Set Requirements:</strong> Determine compute and deployment needs</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📋 Required Fields
          </h4>
          <ul class="guide-list">
            <li><strong>Name:</strong> Unique, descriptive identifier</li>
            <li><strong>Type:</strong> Model category and architecture</li>
            <li><strong>Description:</strong> Clear explanation of purpose</li>
            <li><strong>Framework:</strong> Development framework used</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Configuration Tips
          </h4>
          <ul class="guide-list">
            <li><strong>Start Simple:</strong> Begin with basic configurations</li>
            <li><strong>Hyperparameters:</strong> Use standard values initially</li>
            <li><strong>Validation:</strong> Always include validation split</li>
            <li><strong>Documentation:</strong> Add detailed descriptions for future reference</li>
          </ul>
        </div>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Create a draft model first, then iterate on the configuration before training. You can always edit the model later.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Model Train Guide -->
    <v-card v-if="currentPage === 'train'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-school
        </v-icon>
        Model Training Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Training Your Model:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Training Process
          </h4>
          <ul class="guide-list">
            <li><strong>Data Upload:</strong> Upload your training dataset</li>
            <li><strong>Configuration Review:</strong> Verify model settings before training</li>
            <li><strong>Training Start:</strong> Monitor progress in real-time</li>
            <li><strong>Validation:</strong> Track performance on validation set</li>
            <li><strong>Completion:</strong> Review final metrics and results</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📈 Monitoring
          </h4>
          <ul class="guide-list">
            <li><strong>Progress Bar:</strong> Visual training progress indicator</li>
            <li><strong>Metrics Dashboard:</strong> Real-time accuracy, loss, and other metrics</li>
            <li><strong>Logs:</strong> Detailed training logs for debugging</li>
            <li><strong>Alerts:</strong> Notifications for training completion or errors</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Best Practices
          </h4>
          <ul class="guide-list">
            <li><strong>Start Small:</strong> Begin with smaller datasets and fewer epochs</li>
            <li><strong>Monitor overfitting:</strong> Watch validation metrics closely</li>
            <li><strong>Save Checkpoints:</strong> Regular model state saves</li>
            <li><strong>Experiment:</strong> Try different hyperparameters</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Training Time:</strong> Training can take minutes to hours depending on model size and dataset. Ensure stable internet connection.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the training logs to identify issues early. Stop training if metrics are not improving.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Model Deploy Guide -->
    <v-card v-if="currentPage === 'deploy'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-rocket-launch
        </v-icon>
        Model Deployment Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Deploying Your Model:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🚀 Deployment Process
          </h4>
          <ul class="guide-list">
            <li><strong>Model Selection:</strong> Choose a trained model to deploy</li>
            <li><strong>Environment Setup:</strong> Configure deployment environment</li>
            <li><strong>Resource Allocation:</strong> Set compute resources and scaling</li>
            <li><strong>Endpoint Creation:</strong> Generate API endpoint for model access</li>
            <li><strong>Health Checks:</strong> Verify deployment is working correctly</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Configuration Options
          </h4>
          <ul class="guide-list">
            <li><strong>Instance Type:</strong> Choose based on model complexity and traffic</li>
            <li><strong>Replicas:</strong> Number of instances for load balancing</li>
            <li><strong>Environment:</strong> Development, staging, or production</li>
            <li><strong>Scaling:</strong> Auto-scaling based on demand</li>
            <li><strong>Monitoring:</strong> Performance and health monitoring</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔗 API Access
          </h4>
          <ul class="guide-list">
            <li><strong>Endpoint URL:</strong> REST API endpoint for predictions</li>
            <li><strong>Authentication:</strong> API keys for secure access</li>
            <li><strong>Rate Limiting:</strong> Request limits and quotas</li>
            <li><strong>Documentation:</strong> API usage examples and documentation</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Production Ready:</strong> Ensure your model is thoroughly tested before production deployment. Monitor performance and costs.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Start with a single replica in development, then scale up based on actual usage patterns and performance requirements.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Model Test Guide -->
    <v-card v-if="currentPage === 'test'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-play-circle
        </v-icon>
        Model Testing Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Testing Your Models:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Model Selection
          </h4>
          <ul class="guide-list">
            <li><strong>Ready Models Only:</strong> Only models with 'ready' status can be tested</li>
            <li><strong>Model Info:</strong> Shows type, framework, and version details</li>
            <li><strong>Visual Indicators:</strong> Icons help identify model types quickly</li>
            <li><strong>Dropdown Selection:</strong> Choose from available trained models</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📝 Input Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Input Format:</strong> Dynamic placeholder based on model type</li>
            <li><strong>Max Tokens:</strong> Control output length (1-4096 tokens)</li>
            <li><strong>Temperature:</strong> Adjust creativity/randomness (0-2)</li>
            <li><strong>Model-Specific:</strong> Different input formats for different model types</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🧪 Testing Process
          </h4>
          <ul class="guide-list">
            <li><strong>Input Validation:</strong> Ensures valid input before testing</li>
            <li><strong>Real-time Feedback:</strong> Loading states and progress indicators</li>
            <li><strong>Error Handling:</strong> Graceful handling of test failures</li>
            <li><strong>Result History:</strong> Track all test results with timestamps</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Result Analysis
          </h4>
          <ul class="guide-list">
            <li><strong>Success/Error Status:</strong> Clear visual indicators for each test</li>
            <li><strong>Input/Output Display:</strong> Side-by-side comparison of data</li>
            <li><strong>Performance Metrics:</strong> Response time and duration tracking</li>
            <li><strong>Test History:</strong> Maintains chronological list of all tests</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Testing Limits:</strong> Ensure your model is properly trained and deployed before testing. Test with various input types to validate model performance.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use different temperature values to test model creativity. Lower values (0-0.5) produce more focused outputs, while higher values (1-2) create more diverse responses.
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  page?: 'list' | 'details' | 'edit' | 'create' | 'train' | 'deploy' | 'test'
}

const props = withDefaults(defineProps<Props>(), {
  page: 'list'
})

// Computed property to determine current page
const currentPage = computed(() => props.page)
</script>

<style scoped>
.model-guides {
  max-width: 100%;
  color: white;
}

.guide-section {
  border-left: 3px solid var(--v-primary-base);
  padding-left: 1rem;
  margin-bottom: 1.5rem;
}

.guide-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.guide-list li {
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
  position: relative;
  color: white;
}

.guide-list li::before {
  content: "•";
  color: var(--v-primary-base);
  font-weight: bold;
  position: absolute;
  left: 0;
}

.v-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: white;
}

.v-card-title {
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 0.5rem;
  color: white;
}

.v-card-text {
  color: white;
}

h4 {
  color: white;
}

strong {
  color: white;
}

@media (max-width: 768px) {
  .guide-section {
    padding-left: 0.5rem;
  }
  
  .guide-list li {
    padding-left: 1rem;
  }
}
</style>
