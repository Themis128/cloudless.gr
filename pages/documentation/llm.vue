<template>
  <div>
    <LayoutPageStructure
      title="LLM Documentation"
      subtitle="Learn how to work with Large Language Models"
      back-button-to="/documentation"
      :has-sidebar="false"
      :white-header="true"
    >
      <template #main>
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h5">
            <v-icon start color="primary">mdi-brain</v-icon>
            Large Language Models Overview
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              Large Language Models (LLMs) are powerful AI systems that can understand, generate, and manipulate human language.
              Our platform provides comprehensive tools for working with various LLM providers and models.
            </p>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              <strong>Note:</strong> LLMs require careful configuration and monitoring to ensure optimal performance and cost efficiency.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-cog-sync</v-icon>
            Setting Up LLM Providers
          </v-card-title>
          <v-card-text>
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Supported Providers</h4>
              <v-row>
                <v-col cols="12" sm="6" md="4">
                  <v-card variant="outlined" class="text-center pa-4">
                    <v-icon size="32" color="green" class="mb-2">mdi-openai</v-icon>
                    <h6 class="text-h6">OpenAI</h6>
                    <p class="text-body-2">GPT-4, GPT-3.5-turbo</p>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="4">
                  <v-card variant="outlined" class="text-center pa-4">
                    <v-icon size="32" color="blue" class="mb-2">mdi-google</v-icon>
                    <h6 class="text-h6">Google</h6>
                    <p class="text-body-2">PaLM, Gemini</p>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="4">
                  <v-card variant="outlined" class="text-center pa-4">
                    <v-icon size="32" color="purple" class="mb-2">mdi-anthropic</v-icon>
                    <h6 class="text-h6">Anthropic</h6>
                    <p class="text-body-2">Claude</p>
                  </v-card>
                </v-col>
              </v-row>
            </div>
            
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Configuration Steps</h4>
              <ol class="text-body-2">
                <li class="mb-2">Obtain API keys from your chosen provider</li>
                <li class="mb-2">Configure environment variables securely</li>
                <li class="mb-2">Set up model parameters and limits</li>
                <li class="mb-2">Test connectivity and response times</li>
              </ol>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-tune</v-icon>
            Model Configuration
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Temperature</h4>
                <p class="text-body-2 mb-3">
                  Controls randomness in responses. Lower values (0.1-0.3) produce more focused, 
                  deterministic outputs, while higher values (0.7-1.0) create more creative responses.
                </p>
                <v-slider
                  v-model="temperature"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  show-ticks
                  thumb-label
                  class="mb-4"
                />
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Max Tokens</h4>
                <p class="text-body-2 mb-3">
                  Limits the length of generated responses. Set appropriate limits to control costs
                  and ensure responses fit your application's requirements.
                </p>
                <v-text-field
                  v-model="maxTokens"
                  type="number"
                  label="Max Tokens"
                  variant="outlined"
                  class="mb-4"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Top P</h4>
                <p class="text-body-2 mb-3">
                  Nucleus sampling parameter that controls diversity by considering only the most likely tokens.
                </p>
                <v-slider
                  v-model="topP"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  show-ticks
                  thumb-label
                />
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Frequency Penalty</h4>
                <p class="text-body-2 mb-3">
                  Reduces the likelihood of repeating the same information in responses.
                </p>
                <v-slider
                  v-model="frequencyPenalty"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  show-ticks
                  thumb-label
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-chat-processing</v-icon>
            Prompt Engineering
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              Effective prompt engineering is crucial for getting the best results from LLMs:
            </p>
            
            <v-alert type="success" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-check-circle</v-icon>
              </template>
              <strong>Be Specific:</strong> Provide clear, detailed instructions and context.
            </v-alert>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-format-list-bulleted</v-icon>
              </template>
              <strong>Use Examples:</strong> Include sample inputs and expected outputs.
            </v-alert>
            
            <v-alert type="warning" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-shield-alert</v-icon>
              </template>
              <strong>Safety First:</strong> Implement content filtering and safety measures.
            </v-alert>
            
            <v-alert type="error" variant="tonal">
              <template #prepend>
                <v-icon>mdi-test-tube</v-icon>
              </template>
              <strong>Test Thoroughly:</strong> Validate responses across different scenarios.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-chart-line</v-icon>
            Monitoring & Analytics
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="primary" class="mb-2">mdi-clock-outline</v-icon>
                  <h5 class="text-h6">Response Time</h5>
                  <p class="text-body-2">Monitor API latency and performance</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="success" class="mb-2">mdi-currency-usd</v-icon>
                  <h5 class="text-h6">Cost Tracking</h5>
                  <p class="text-body-2">Track token usage and expenses</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="info" class="mb-2">mdi-chat-question</v-icon>
                  <h5 class="text-h6">Quality Metrics</h5>
                  <p class="text-body-2">Evaluate response quality and relevance</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="warning" class="mb-2">mdi-alert-circle</v-icon>
                  <h5 class="text-h6">Error Rates</h5>
                  <p class="text-body-2">Monitor failures and retry patterns</p>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-help-circle</v-icon>
            Best Practices & Tips
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Performance Optimization</h4>
                <ul class="text-body-2">
                  <li>Cache frequently used responses</li>
                  <li>Implement request batching</li>
                  <li>Use streaming for long responses</li>
                  <li>Monitor and optimize token usage</li>
                </ul>
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Security Considerations</h4>
                <ul class="text-body-2">
                  <li>Secure API key storage</li>
                  <li>Implement rate limiting</li>
                  <li>Validate and sanitize inputs</li>
                  <li>Monitor for sensitive data exposure</li>
                </ul>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Reactive form data
const temperature = ref(0.7)
const maxTokens = ref(1000)
const topP = ref(0.9)
const frequencyPenalty = ref(0.0)

// SEO Meta Tags
useHead({
  title: 'LLM Documentation - Cloudless',
  meta: [
    { name: 'description', content: 'Learn how to work with Large Language Models effectively with our comprehensive documentation.' },
    { property: 'og:title', content: 'LLM Documentation - Cloudless' },
    { property: 'og:description', content: 'Large Language Model documentation and best practices' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'LLM Documentation - Cloudless' },
    { name: 'twitter:description', content: 'Large Language Model documentation and best practices' }
  ]
})

// Page Meta
definePageMeta({
  title: 'LLM Documentation',
  description: 'Learn how to work with Large Language Models'
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding-bottom: 1rem;
}

.v-alert {
  border-radius: 8px;
}
</style> 