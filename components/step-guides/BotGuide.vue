<template>
  <div>
    <!-- Bot List Guide -->
    <v-card v-if="currentPage === 'list'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-robot
        </v-icon>
        Bot Management Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Managing Your Bots:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🤖 Bot Overview
          </h4>
          <ul class="guide-list">
            <li><strong>Bot Types:</strong> Customer Support, Developer Assistant, Data Analyst, Content Writer</li>
            <li><strong>Status Tracking:</strong> Draft, Active, Inactive, Error states</li>
            <li><strong>Quick Actions:</strong> Create, test, and manage bots from the main list</li>
            <li><strong>Search & Filter:</strong> Find bots by name, type, or description</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📋 Bot Information
          </h4>
          <ul class="guide-list">
            <li><strong>Bot Name:</strong> Descriptive name for easy identification</li>
            <li><strong>Type:</strong> Defines the bot's primary function and capabilities</li>
            <li><strong>Status:</strong> Current operational state of the bot</li>
            <li><strong>Version:</strong> Bot version for tracking updates</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚡ Quick Actions
          </h4>
          <ul class="guide-list">
            <li><strong>Create Bot:</strong> Build new bots with the bot builder</li>
            <li><strong>Test Bot:</strong> Test bot responses and functionality</li>
            <li><strong>Edit Bot:</strong> Modify bot configuration and settings</li>
            <li><strong>Delete Bot:</strong> Remove bots you no longer need</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Important:</strong> Only active bots can be tested and deployed. Ensure your bots are properly configured before activation.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use descriptive names and clear descriptions to easily identify and manage your bots. Regular testing helps ensure optimal performance.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Bot Details Guide -->
    <v-card v-if="currentPage === 'details'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-information
        </v-icon>
        Bot Details Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Understanding Bot Details:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Bot Information
          </h4>
          <ul class="guide-list">
            <li><strong>Configuration:</strong> Review bot settings and parameters</li>
            <li><strong>Performance Metrics:</strong> View response times and success rates</li>
            <li><strong>Usage Statistics:</strong> Track bot interactions and popularity</li>
            <li><strong>Version History:</strong> See bot updates and changes</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🛠️ Management Actions
          </h4>
          <ul class="guide-list">
            <li><strong>Edit Bot:</strong> Modify configuration and settings</li>
            <li><strong>Test Bot:</strong> Run test conversations</li>
            <li><strong>Deploy Bot:</strong> Make bot available for use</li>
            <li><strong>Delete Bot:</strong> Remove bot permanently</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Monitoring
          </h4>
          <ul class="guide-list">
            <li><strong>Status Monitoring:</strong> Track bot health and performance</li>
            <li><strong>Error Logs:</strong> Review and resolve issues</li>
            <li><strong>Usage Analytics:</strong> Understand bot interaction patterns</li>
            <li><strong>Performance Metrics:</strong> Monitor response quality</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Monitoring:</strong> Regularly check bot performance and user feedback to ensure optimal functionality.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use the test functionality to validate bot responses before deploying to production.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Bot Edit Guide -->
    <v-card v-if="currentPage === 'edit'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-pencil
        </v-icon>
        Bot Editing Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Editing Your Bot:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ✏️ Basic Information
          </h4>
          <ul class="guide-list">
            <li><strong>Bot Name:</strong> Update the display name</li>
            <li><strong>Description:</strong> Modify bot description and purpose</li>
            <li><strong>Type:</strong> Change bot category if needed</li>
            <li><strong>Status:</strong> Update operational status</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Model Settings:</strong> Adjust underlying AI model parameters</li>
            <li><strong>Response Settings:</strong> Configure response length and style</li>
            <li><strong>Behavior Rules:</strong> Set conversation guidelines</li>
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
          <strong>⚠️ Testing:</strong> Always test your bot after making changes to ensure it works as expected.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use version control to track changes and easily rollback if issues arise.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Bot Builder Guide -->
    <v-card v-if="currentPage === 'create'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-plus-circle
        </v-icon>
        Bot Creation Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Creating Your Bot:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Bot Planning
          </h4>
          <ul class="guide-list">
            <li><strong>Purpose:</strong> Define what your bot should do</li>
            <li><strong>Target Users:</strong> Identify who will use the bot</li>
            <li><strong>Use Cases:</strong> Plan specific scenarios and interactions</li>
            <li><strong>Success Metrics:</strong> Define how to measure bot success</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔧 Configuration Steps
          </h4>
          <ul class="guide-list">
            <li><strong>Basic Info:</strong> Set name, description, and type</li>
            <li><strong>Model Selection:</strong> Choose appropriate AI model</li>
            <li><strong>Prompt Engineering:</strong> Design conversation flows</li>
            <li><strong>Integration Setup:</strong> Connect to external services</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🧪 Testing & Validation
          </h4>
          <ul class="guide-list">
            <li><strong>Test Conversations:</strong> Validate bot responses</li>
            <li><strong>Edge Cases:</strong> Test unusual or complex inputs</li>
            <li><strong>Performance Testing:</strong> Ensure fast response times</li>
            <li><strong>User Feedback:</strong> Gather input from test users</li>
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

    <!-- Bot Test Guide -->
    <v-card v-if="currentPage === 'test'" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">
          mdi-play-circle
        </v-icon>
        Bot Testing Guide
      </v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Testing Your Bots:</strong>
        </v-alert>
        
        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🎯 Test Scenarios
          </h4>
          <ul class="guide-list">
            <li><strong>Greeting Test:</strong> Basic introduction and welcome</li>
            <li><strong>Help Request:</strong> Assistance and support capabilities</li>
            <li><strong>Technical Questions:</strong> Knowledge and explanation skills</li>
            <li><strong>Conversation Flow:</strong> Natural dialogue and engagement</li>
            <li><strong>Custom Messages:</strong> Test with your own inputs</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            ⚙️ Test Configuration
          </h4>
          <ul class="guide-list">
            <li><strong>Bot Selection:</strong> Choose from available active bots</li>
            <li><strong>Scenario Selection:</strong> Pick predefined test scenarios</li>
            <li><strong>Max Tokens:</strong> Control response length (1-4096)</li>
            <li><strong>Custom Messages:</strong> Test with specific inputs</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            📊 Result Analysis
          </h4>
          <ul class="guide-list">
            <li><strong>Conversation History:</strong> Review full dialogue flow</li>
            <li><strong>Response Quality:</strong> Assess bot answer relevance</li>
            <li><strong>Performance Metrics:</strong> Check response times</li>
            <li><strong>Error Handling:</strong> Identify and fix issues</li>
          </ul>
        </div>

        <div class="guide-section mb-3">
          <h4 class="text-subtitle-1 font-weight-bold mb-2">
            🔍 Testing Tips
          </h4>
          <ul class="guide-list">
            <li><strong>Test Multiple Scenarios:</strong> Cover various use cases</li>
            <li><strong>Check Response Accuracy:</strong> Verify information quality</li>
            <li><strong>Monitor Response Time:</strong> Ensure fast interactions</li>
            <li><strong>Test Edge Cases:</strong> Try unusual or complex inputs</li>
          </ul>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>⚠️ Testing Limits:</strong> Only active bots can be tested. Ensure your bot is properly configured and deployed before testing.
        </v-alert>

        <v-alert type="success" variant="tonal" class="mt-3">
          <strong>💡 Pro Tip:</strong> Use different test scenarios to thoroughly validate your bot's capabilities across various conversation types.
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  page?: 'list' | 'details' | 'edit' | 'create' | 'test'
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

/* Ensure card titles are black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

/* Ensure all text in the guide is black */
:deep(.text-subtitle-1),
:deep(.text-body-1),
:deep(.text-body-2),
:deep(.guide-list li),
:deep(.v-alert) {
  color: black !important;
}

:deep(.v-alert strong) {
  color: black !important;
}
</style>
