<template>
  <div>
    <!-- Project List Guide -->
    <v-card v-if="currentPage === 'list'" class="mb-4">
      <v-card-title class="d-flex align-center project-guide-title">
        <v-icon start color="primary">
          mdi-folder-multiple
        </v-icon>
        Project Management Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Managing Your Projects:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Project Overview
          </h4>
          <ul class="guide-list">
            <li><strong>Project Statistics:</strong> Total projects and average components</li>
            <li><strong>Component Distribution:</strong> Bots, models, and pipelines per project</li>
            <li><strong>Visual Charts:</strong> Interactive project analytics</li>
            <li><strong>Quick Actions:</strong> Create, test, and manage projects</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🚀 Getting Started
          </h4>
          <ul class="guide-list">
            <li><strong>Create Project:</strong> Start with a new project</li>
            <li><strong>Add Components:</strong> Include bots, models, and pipelines</li>
            <li><strong>Organize Workflows:</strong> Structure your AI solutions</li>
            <li><strong>Test Integration:</strong> Validate project functionality</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Best Practices:</strong> Use descriptive names and organize components logically.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Group related AI components into projects for better organization and management.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Project Test Guide -->
    <v-card v-if="currentPage === 'test'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-play-circle
        </v-icon>
        Project Testing Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Testing Your Projects:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Test Scenarios
          </h4>
          <ul class="guide-list">
            <li><strong>Comprehensive Test:</strong> Full project validation</li>
            <li><strong>Quick Validation:</strong> Basic functionality check</li>
            <li><strong>Performance Test:</strong> System performance evaluation</li>
            <li><strong>Integration Test:</strong> Component interaction testing</li>
            <li><strong>Custom Test:</strong> User-defined test scenarios</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Test Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Project Selection:</strong> Choose from available projects</li>
            <li><strong>Test Depth:</strong> Basic, Standard, Deep, or Exhaustive</li>
            <li><strong>Custom Data:</strong> Test with specific input data</li>
            <li><strong>Progress Tracking:</strong> Monitor test execution</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Result Analysis
          </h4>
          <ul class="guide-list">
            <li><strong>Step-by-Step Progress:</strong> Monitor each test stage</li>
            <li><strong>Component Validation:</strong> Check bots, models, and pipelines</li>
            <li><strong>Integration Results:</strong> Verify component interactions</li>
            <li><strong>Performance Metrics:</strong> Assess system efficiency</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Testing Requirements:</strong> Ensure all project components are properly configured before testing.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use different test scenarios to thoroughly validate your project's capabilities and identify potential issues.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Project Manage Guide -->
    <v-card v-if="currentPage === 'manage'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-cog
        </v-icon>
        Project Management Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Advanced Project Management:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Overview Dashboard
          </h4>
          <ul class="guide-list">
            <li><strong>Project Statistics:</strong> Total, active, draft, and average components</li>
            <li><strong>Status Distribution:</strong> Visual breakdown of project states</li>
            <li><strong>Quick Metrics:</strong> At-a-glance performance indicators</li>
            <li><strong>Real-time Updates:</strong> Live data refresh capabilities</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚡ Bulk Operations
          </h4>
          <ul class="guide-list">
            <li><strong>Status Updates:</strong> Change multiple project statuses at once</li>
            <li><strong>Bulk Deletion:</strong> Remove multiple projects efficiently</li>
            <li><strong>Selection Tools:</strong> Choose projects with checkboxes</li>
            <li><strong>Confirmation Dialogs:</strong> Safe operation confirmations</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Advanced Table
          </h4>
          <ul class="guide-list">
            <li><strong>Sortable Columns:</strong> Sort by name, status, components, or date</li>
            <li><strong>Search Functionality:</strong> Find projects by name or description</li>
            <li><strong>Quick Actions:</strong> View, edit, test, or delete individual projects</li>
            <li><strong>Visual Indicators:</strong> Status chips and component counts</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🛠️ Management Tools
          </h4>
          <ul class="guide-list">
            <li><strong>Status Management:</strong> Active, Draft, Inactive, Archived</li>
            <li><strong>Bulk Operations:</strong> Update multiple projects simultaneously</li>
            <li><strong>Search & Filter:</strong> Quickly locate specific projects</li>
            <li><strong>Refresh Data:</strong> Update project list manually</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Bulk Operations:</strong> Be careful with bulk operations as they affect multiple projects at once. Always review your selections before confirming.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the search functionality to quickly find specific projects, and use bulk operations to efficiently manage large numbers of projects.
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  page?: 'list' | 'test' | 'manage'
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

.project-guide-title {
  color: black !important;
  flex-wrap: wrap !important;
  word-wrap: break-word !important;
  white-space: normal !important;
  line-height: 1.2 !important;
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
