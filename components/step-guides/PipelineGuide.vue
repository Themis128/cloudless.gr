<template>
  <div>
    <!-- Pipeline List Guide -->
    <v-card v-if="currentPage === 'list'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-pipe
        </v-icon>
        Pipeline Management Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Managing Your Pipelines:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔧 Pipeline Overview
          </h4>
          <ul class="guide-list">
            <li><strong>Pipeline Types:</strong> Data Processing, Text Analysis, Image Processing, ML Pipeline, ETL</li>
            <li><strong>Status Tracking:</strong> Draft, Active, Inactive, Error states</li>
            <li><strong>Quick Actions:</strong> Create, test, and manage pipelines from the main list</li>
            <li><strong>Search & Filter:</strong> Find pipelines by name, type, or description</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📋 Pipeline Information
          </h4>
          <ul class="guide-list">
            <li><strong>Pipeline Name:</strong> Descriptive name for easy identification</li>
            <li><strong>Type:</strong> Defines the pipeline's primary function and capabilities</li>
            <li><strong>Status:</strong> Current operational state of the pipeline</li>
            <li><strong>Version:</strong> Pipeline version for tracking updates</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚡ Quick Actions
          </h4>
          <ul class="guide-list">
            <li><strong>Create Pipeline:</strong> Build new pipelines with the pipeline builder</li>
            <li><strong>Test Pipeline:</strong> Test pipeline processing and functionality</li>
            <li><strong>Edit Pipeline:</strong> Modify pipeline configuration and settings</li>
            <li><strong>Delete Pipeline:</strong> Remove pipelines you no longer need</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Important:</strong> Only active pipelines can be tested and deployed. Ensure your pipelines are properly configured before activation.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use descriptive names and clear descriptions to easily identify and manage your pipelines. Regular testing helps ensure optimal performance.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Pipeline Details Guide -->
    <v-card v-if="currentPage === 'details'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-information
        </v-icon>
        Pipeline Details Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Understanding Pipeline Details:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Pipeline Information
          </h4>
          <ul class="guide-list">
            <li><strong>Configuration:</strong> Review pipeline settings and parameters</li>
            <li><strong>Performance Metrics:</strong> View processing times and success rates</li>
            <li><strong>Usage Statistics:</strong> Track pipeline executions and data volume</li>
            <li><strong>Version History:</strong> See pipeline updates and changes</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🛠️ Management Actions
          </h4>
          <ul class="guide-list">
            <li><strong>Edit Pipeline:</strong> Modify configuration and settings</li>
            <li><strong>Test Pipeline:</strong> Run test executions</li>
            <li><strong>Deploy Pipeline:</strong> Make pipeline available for use</li>
            <li><strong>Delete Pipeline:</strong> Remove pipeline permanently</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Monitoring
          </h4>
          <ul class="guide-list">
            <li><strong>Status Monitoring:</strong> Track pipeline health and performance</li>
            <li><strong>Error Logs:</strong> Review and resolve processing issues</li>
            <li><strong>Usage Analytics:</strong> Understand pipeline execution patterns</li>
            <li><strong>Performance Metrics:</strong> Monitor processing efficiency</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Monitoring:</strong> Regularly check pipeline performance and execution logs to ensure optimal functionality.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the test functionality to validate pipeline processing before deploying to production.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Pipeline Edit Guide -->
    <v-card v-if="currentPage === 'edit'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-pencil
        </v-icon>
        Pipeline Editing Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Editing Your Pipeline:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ✏️ Basic Information
          </h4>
          <ul class="guide-list">
            <li><strong>Pipeline Name:</strong> Update the display name</li>
            <li><strong>Description:</strong> Modify pipeline description and purpose</li>
            <li><strong>Type:</strong> Change pipeline category if needed</li>
            <li><strong>Status:</strong> Update operational status</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Processing Steps:</strong> Add, remove, or modify pipeline steps</li>
            <li><strong>Data Flow:</strong> Configure data transformation and routing</li>
            <li><strong>Error Handling:</strong> Set error recovery and fallback options</li>
            <li><strong>Integration Settings:</strong> Update external connections</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            💾 Saving Changes
          </h4>
          <ul class="guide-list">
            <li><strong>Save Draft:</strong> Save changes without publishing</li>
            <li><strong>Publish Changes:</strong> Make changes live immediately</li>
            <li><strong>Version Control:</strong> Track changes with version numbers</li>
            <li><strong>Rollback:</strong> Revert to previous versions if needed</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Testing:</strong> Always test your pipeline after making changes to ensure it works as expected.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use version control to track changes and easily rollback if issues arise.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Pipeline Builder Guide -->
    <v-card v-if="currentPage === 'create'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-plus-circle
        </v-icon>
        Pipeline Creation Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Creating Your Pipeline:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Pipeline Planning
          </h4>
          <ul class="guide-list">
            <li><strong>Purpose:</strong> Define what your pipeline should process</li>
            <li><strong>Data Flow:</strong> Plan input, processing, and output stages</li>
            <li><strong>Processing Steps:</strong> Identify required transformations</li>
            <li><strong>Success Metrics:</strong> Define how to measure pipeline success</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔧 Configuration Steps
          </h4>
          <ul class="guide-list">
            <li><strong>Basic Info:</strong> Set name, description, and type</li>
            <li><strong>Step Configuration:</strong> Add and configure processing steps</li>
            <li><strong>Data Flow:</strong> Define data transformation logic</li>
            <li><strong>Integration Setup:</strong> Connect to external services</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🧪 Testing & Validation
          </h4>
          <ul class="guide-list">
            <li><strong>Test Execution:</strong> Validate pipeline processing</li>
            <li><strong>Edge Cases:</strong> Test unusual or complex data</li>
            <li><strong>Performance Testing:</strong> Ensure efficient processing</li>
            <li><strong>Error Handling:</strong> Test error scenarios</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Best Practices:</strong> Start with a clear purpose and test thoroughly before deployment.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use templates as starting points and customize them for your specific needs.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Pipeline Test Guide -->
    <v-card v-if="currentPage === 'test'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-play-circle
        </v-icon>
        Pipeline Testing Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Testing Your Pipelines:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Test Scenarios
          </h4>
          <ul class="guide-list">
            <li><strong>Text Processing:</strong> NLP and text analysis workflows</li>
            <li><strong>Data Transformation:</strong> Data cleaning and transformation</li>
            <li><strong>Image Processing:</strong> Image analysis and manipulation</li>
            <li><strong>ML Inference:</strong> Machine learning model execution</li>
            <li><strong>Custom Input:</strong> Test with your own data</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Test Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Pipeline Selection:</strong> Choose from available active pipelines</li>
            <li><strong>Scenario Selection:</strong> Pick predefined test scenarios</li>
            <li><strong>Batch Size:</strong> Control data processing volume (1-1000)</li>
            <li><strong>Custom Input:</strong> Test with specific data formats</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Result Analysis
          </h4>
          <ul class="guide-list">
            <li><strong>Step-by-Step Progress:</strong> Monitor each processing stage</li>
            <li><strong>Output Quality:</strong> Assess processing results</li>
            <li><strong>Performance Metrics:</strong> Check processing times</li>
            <li><strong>Error Handling:</strong> Identify and fix issues</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Testing Tips
          </h4>
          <ul class="guide-list">
            <li><strong>Test Multiple Scenarios:</strong> Cover various data types</li>
            <li><strong>Check Processing Accuracy:</strong> Verify output quality</li>
            <li><strong>Monitor Performance:</strong> Ensure efficient processing</li>
            <li><strong>Test Error Conditions:</strong> Try invalid or edge case data</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Testing Limits:</strong> Only active pipelines can be tested. Ensure your pipeline is properly configured and deployed before testing.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use different test scenarios to thoroughly validate your pipeline's capabilities across various data types and processing requirements.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Pipeline Manage Guide -->
    <v-card v-if="currentPage === 'manage'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-cog
        </v-icon>
        Pipeline Management Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Managing Your Pipelines:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Overview Dashboard
          </h4>
          <ul class="guide-list">
            <li><strong>Pipeline Statistics:</strong> Total, active, draft, and average steps</li>
            <li><strong>Status Distribution:</strong> Visual breakdown of pipeline states</li>
            <li><strong>Quick Metrics:</strong> At-a-glance performance indicators</li>
            <li><strong>Real-time Updates:</strong> Live data refresh capabilities</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚡ Bulk Operations
          </h4>
          <ul class="guide-list">
            <li><strong>Status Updates:</strong> Change multiple pipeline statuses at once</li>
            <li><strong>Bulk Deletion:</strong> Remove multiple pipelines efficiently</li>
            <li><strong>Selection Tools:</strong> Choose pipelines with checkboxes</li>
            <li><strong>Confirmation Dialogs:</strong> Safe operation confirmations</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Advanced Table
          </h4>
          <ul class="guide-list">
            <li><strong>Sortable Columns:</strong> Sort by name, status, steps, or date</li>
            <li><strong>Search Functionality:</strong> Find pipelines by name or description</li>
            <li><strong>Quick Actions:</strong> View, edit, test, or delete individual pipelines</li>
            <li><strong>Visual Indicators:</strong> Status chips and pipeline icons</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🛠️ Management Tools
          </h4>
          <ul class="guide-list">
            <li><strong>Status Management:</strong> Draft, Active, Inactive, Archived</li>
            <li><strong>Bulk Operations:</strong> Update multiple pipelines simultaneously</li>
            <li><strong>Search & Filter:</strong> Quickly locate specific pipelines</li>
            <li><strong>Refresh Data:</strong> Update pipeline list manually</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Bulk Operations:</strong> Be careful with bulk operations as they affect multiple pipelines at once. Always review your selections before confirming.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the search functionality to quickly find specific pipelines, and use bulk operations to efficiently manage large numbers of pipelines.
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  page?: 'list' | 'details' | 'edit' | 'create' | 'test' | 'manage'
}

const props = withDefaults(defineProps<Props>(), {
  page: 'list'
})

const currentPage = computed(() => props.page)
</script>

<style scoped>
.guide-section {
  margin-bottom: 1.5rem;
}

.guide-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.guide-list li {
  padding: 0.25rem 0;
  position: relative;
  padding-left: 1.5rem;
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
}
</style>
