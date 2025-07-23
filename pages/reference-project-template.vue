<template>
  <div class="reference-project-template-page">
    <div class="page-header">
      <h1>
        <v-icon size="32" class="mr-3">
          mdi-rocket-launch
        </v-icon>
        Reference Project Template
      </h1>
      <p class="subtitle">
        Create a comprehensive AI-Powered Chatbot reference project with all components
      </p>
    </div>

    <div class="content-container">
      <div class="template-content">
        <!-- Project Overview Card -->
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon size="24" class="mr-2">
              mdi-information
            </v-icon>
            What Will Be Created
          </v-card-title>
          <v-card-text>
            <div class="project-overview">
              <div class="overview-item">
                <h3>📋 Project: AI-Powered Chatbot</h3>
                <ul>
                  <li>Customer service chatbot with machine learning capabilities</li>
                  <li>Multi-language support and analytics dashboard</li>
                  <li>Status: Active, Category: Machine Learning</li>
                </ul>
              </div>
              
              <div class="overview-item">
                <h3>🤖 Bot: Customer Service Assistant</h3>
                <ul>
                  <li>GPT-4 powered with intelligent response generation</li>
                  <li>Multi-language support (EN, ES, FR, DE, ZH)</li>
                  <li>Intent recognition, sentiment analysis, escalation handling</li>
                </ul>
              </div>
              
              <div class="overview-item">
                <h3>🔧 Pipeline: Customer Data Processor</h3>
                <ul>
                  <li>6-step processing pipeline</li>
                  <li>Input validation, language detection, sentiment analysis</li>
                  <li>Intent classification, data enrichment, response generation</li>
                </ul>
              </div>
              
              <div class="overview-item">
                <h3>📊 Analytics Dashboard</h3>
                <ul>
                  <li>Real-time metrics and automated alerts</li>
                  <li>Customer satisfaction tracking</li>
                  <li>Performance monitoring and export capabilities</li>
                </ul>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Configuration Form -->
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon size="24" class="mr-2">
              mdi-cog
            </v-icon>
            Configuration
          </v-card-title>
          <v-card-text>
            <v-form ref="form" v-model="isValid">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.baseUrl"
                    label="Base URL"
                    hint="The base URL of your application"
                    placeholder="http://localhost:3000"
                    :rules="[v => !!v || 'Base URL is required']"
                    variant="outlined"
                    class="mb-4"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.apiBase"
                    label="API Base URL"
                    hint="The API base URL"
                    placeholder="http://localhost:3000/api"
                    :rules="[v => !!v || 'API Base URL is required']"
                    variant="outlined"
                    class="mb-4"
                  />
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.projectName"
                    label="Project Name"
                    hint="Name for the reference project"
                    placeholder="AI-Powered Chatbot"
                    :rules="[v => !!v || 'Project name is required']"
                    variant="outlined"
                    class="mb-4"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.botName"
                    label="Bot Name"
                    hint="Name for the customer service bot"
                    placeholder="Customer Service Assistant"
                    :rules="[v => !!v || 'Bot name is required']"
                    variant="outlined"
                    class="mb-4"
                  />
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12">
                  <v-textarea
                    v-model="config.description"
                    label="Project Description"
                    hint="Description for the reference project"
                    placeholder="Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard."
                    :rules="[v => !!v || 'Description is required']"
                    variant="outlined"
                    rows="3"
                    class="mb-4"
                  />
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- Action Buttons -->
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon size="24" class="mr-2">
              mdi-play-circle
            </v-icon>
            Create Reference Project
          </v-card-title>
          <v-card-text>
            <div class="action-buttons">
              <v-btn
                color="primary"
                size="large"
                :loading="loading"
                :disabled="!isValid || loading"
                @click="createReferenceProject"
                class="mr-4"
              >
                <v-icon start>
                  mdi-rocket-launch
                </v-icon>
                Create Reference Project
              </v-btn>
              
              <v-btn
                color="secondary"
                size="large"
                variant="outlined"
                @click="resetForm"
                :disabled="loading"
              >
                <v-icon start>
                  mdi-refresh
                </v-icon>
                Reset Form
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Progress and Results -->
        <v-card v-if="loading || results" class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon size="24" class="mr-2">
              {{ loading ? 'mdi-loading' : 'mdi-check-circle' }}
            </v-icon>
            {{ loading ? 'Creating Project...' : 'Results' }}
          </v-card-title>
          <v-card-text>
            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
              <v-progress-linear
                indeterminate
                color="primary"
                class="mb-4"
              />
              <div class="loading-steps">
                <div v-for="(step, index) in loadingSteps" :key="index" class="loading-step">
                  <v-icon 
                    :color="step.completed ? 'success' : step.current ? 'primary' : 'grey'"
                    size="20"
                    class="mr-2"
                  >
                    {{ step.completed ? 'mdi-check' : step.current ? 'mdi-loading' : 'mdi-circle-outline' }}
                  </v-icon>
                  <span :class="{ 'text-primary': step.current, 'text-success': step.completed }">
                    {{ step.name }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Results State -->
            <div v-if="results && !loading" class="results-state">
              <v-alert
                :type="demoMode ? 'warning' : 'success'"
                :title="demoMode ? 'Demo Project Created Successfully!' : 'Reference Project Created Successfully!'"
                class="mb-4"
              >
                <template v-if="demoMode">
                  <p>Your AI-Powered Chatbot reference project has been created in demo mode. The API server was not available, so mock data was generated.</p>
                  <p class="text-caption mt-2">To create real projects, ensure the API server is running at {{ config.apiBase }}</p>
                </template>
                <template v-else>
                  Your AI-Powered Chatbot reference project has been created with all components.
                </template>
              </v-alert>
              
              <div class="results-details">
                <h3>📋 Project Details:</h3>
                <ul>
                  <li><strong>Name:</strong> {{ results.projectName }}</li>
                  <li><strong>ID:</strong> {{ results.projectId }} <v-chip v-if="demoMode" size="x-small" color="warning" class="ml-2">Demo</v-chip></li>
                  <li><strong>Status:</strong> Active</li>
                </ul>
                
                <h3>🤖 Bot Components:</h3>
                <ul>
                  <li><strong>Customer Service Assistant</strong> (ID: {{ results.botId }}) <v-chip v-if="demoMode" size="x-small" color="warning" class="ml-2">Demo</v-chip></li>
                  <li>- Multi-language support</li>
                  <li>- Intent recognition</li>
                  <li>- Sentiment analysis</li>
                </ul>
                
                <h3>🔧 Pipeline Components:</h3>
                <ul>
                  <li><strong>Customer Data Processor</strong> (ID: {{ results.pipelineId }}) <v-chip v-if="demoMode" size="x-small" color="warning" class="ml-2">Demo</v-chip></li>
                  <li>- 6 processing steps</li>
                  <li>- Error handling</li>
                  <li>- Performance optimization</li>
                </ul>
                
                <h3>📊 Analytics Dashboard (ID: {{ results.analyticsId }}) <v-chip v-if="demoMode" size="x-small" color="warning" class="ml-2">Demo</v-chip></h3>
                <ul>
                  <li>- Real-time metrics</li>
                  <li>- Automated alerts</li>
                  <li>- Export capabilities</li>
                </ul>
              </div>
              
              <div class="results-actions mt-4">
                <v-btn
                  :href="`${config.baseUrl}/projects/${results.projectId}`"
                  target="_blank"
                  color="primary"
                  variant="elevated"
                  class="mr-4"
                >
                  <v-icon start>
                    mdi-eye
                  </v-icon>
                  View Project
                </v-btn>
                
                <v-btn
                  @click="createAnother"
                  color="secondary"
                  variant="outlined"
                >
                  <v-icon start>
                    mdi-plus
                  </v-icon>
                  Create Another
                </v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Error Display -->
        <v-card v-if="error" class="mb-6 bg-white">
          <v-card-title class="text-h6 text-error">
            <v-icon size="24" class="mr-2">
              mdi-alert-circle
            </v-icon>
            Error
          </v-card-title>
          <v-card-text>
            <v-alert
              type="error"
              :title="error"
              class="mb-4"
            />
            <v-btn
              color="primary"
              @click="retryCreation"
              :disabled="loading"
            >
              <v-icon start>
                mdi-refresh
              </v-icon>
              Retry
            </v-btn>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

// Form validation
const form = ref()
const isValid = ref(false)

// Configuration
const config = reactive({
  baseUrl: 'http://localhost:3000',
  apiBase: 'http://localhost:3000/api',
  projectName: 'AI-Powered Chatbot',
  botName: 'Customer Service Assistant',
  description: 'Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard.'
})

// State
const loading = ref(false)
const error = ref('')
const results = ref<any>(null)
const demoMode = ref(false)

// Loading steps
const loadingSteps = ref([
  { name: 'Creating Project', completed: false, current: false },
  { name: 'Creating Bot', completed: false, current: false },
  { name: 'Creating Pipeline', completed: false, current: false },
  { name: 'Creating Analytics Dashboard', completed: false, current: false },
  { name: 'Finalizing Setup', completed: false, current: false }
])

// Mock data for demo mode
const createMockData = () => {
  const timestamp = Date.now()
  return {
    projectId: `demo-project-${timestamp}`,
    botId: `demo-bot-${timestamp}`,
    pipelineId: `demo-pipeline-${timestamp}`,
    analyticsId: `demo-analytics-${timestamp}`,
    projectName: config.projectName
  }
}

// API call function
async function makeApiCall(endpoint: string, method = 'GET', body: any = null) {
  const headers = {
    'Content-Type': 'application/json'
  }
  
  const url = `${config.apiBase}${endpoint}`
  
  try {
    console.log(`Making ${method} request to ${url}`)
    if (body) {
      console.log('Body:', JSON.stringify(body, null, 2))
    }
    
    const options: any = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) })
    }
    
    const response = await fetch(url, options)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    const data = await response.json()
    return data
  } catch (error: any) {
    console.error(`Error making API call: ${error.message}`)
    
    // If it's a network error (server not running), provide a helpful message
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(`API server is not available. Please ensure the server is running at ${config.apiBase}`)
    }
    
    throw error
  }
}

// Create reference project
async function createReferenceProject() {
  if (!isValid.value) return
  
  loading.value = true
  error.value = ''
  results.value = null
  demoMode.value = false
  
  // Reset loading steps
  loadingSteps.value.forEach(step => {
    step.completed = false
    step.current = false
  })
  
  try {
    // Step 1: Create Project
    loadingSteps.value[0].current = true
    const projectData = {
      project_name: config.projectName,
      description: config.description,
      slug: config.projectName.toLowerCase().replace(/\s+/g, '-'),
      overview: config.description,
      status: 'active',
      category: 'machine-learning',
      featured: true
    }
    
    let project
    try {
      project = await makeApiCall('/prisma/projects', 'POST', projectData)
    } catch (apiError: any) {
      if (apiError.message.includes('API server is not available')) {
        // Switch to demo mode
        demoMode.value = true
        console.log('Switching to demo mode due to API unavailability')
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
        project = { data: { id: `demo-project-${Date.now()}` } }
      } else {
        throw apiError
      }
    }
    
    loadingSteps.value[0].completed = true
    loadingSteps.value[0].current = false
    const projectId = project.data.id
    
    // Step 2: Create Bot
    loadingSteps.value[1].current = true
    const botConfig = {
      name: config.botName,
      description: 'AI-powered customer service chatbot with multi-language support and intelligent response generation',
      config: JSON.stringify({
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        system_prompt: 'You are a helpful customer service assistant. You help customers with their inquiries, provide accurate information, and ensure customer satisfaction. You can handle multiple languages and provide empathetic responses.',
        features: [
          'Multi-language support',
          'Intent recognition',
          'Sentiment analysis',
          'Knowledge base integration',
          'Escalation handling'
        ],
        languages: ['English', 'Spanish', 'French', 'German', 'Chinese'],
        response_templates: {
          greeting: 'Hello! I\'m here to help you. How can I assist you today?',
          escalation: 'I understand your concern. Let me connect you with a human representative who can better assist you.',
          goodbye: 'Thank you for contacting us. Have a great day!'
        }
      }),
      status: 'active'
    }
    
    let bot
    try {
      bot = await makeApiCall('/prisma/bots', 'POST', botConfig)
    } catch (apiError: any) {
      if (demoMode.value) {
        await new Promise(resolve => setTimeout(resolve, 800)) // Simulate API call
        bot = { data: { id: `demo-bot-${Date.now()}` } }
      } else {
        throw apiError
      }
    }
    
    loadingSteps.value[1].completed = true
    loadingSteps.value[1].current = false
    const botId = bot.data.id
    
    // Step 3: Create Pipeline
    loadingSteps.value[2].current = true
    const pipelineConfig = {
      name: 'Customer Data Processor',
      description: 'Pipeline for processing customer interactions, sentiment analysis, and data enrichment',
      config: JSON.stringify({
        steps: [
          {
            name: 'Input Validation',
            type: 'validator',
            config: {
              required_fields: ['customer_id', 'message', 'timestamp'],
              data_types: {
                customer_id: 'string',
                message: 'string',
                timestamp: 'datetime'
              }
            }
          },
          {
            name: 'Language Detection',
            type: 'language_detector',
            config: {
              supported_languages: ['en', 'es', 'fr', 'de', 'zh'],
              confidence_threshold: 0.8
            }
          },
          {
            name: 'Sentiment Analysis',
            type: 'sentiment_analyzer',
            config: {
              model: 'vader',
              output_format: 'score',
              threshold: {
                positive: 0.1,
                negative: -0.1
              }
            }
          },
          {
            name: 'Intent Classification',
            type: 'intent_classifier',
            config: {
              intents: [
                'general_inquiry',
                'technical_support',
                'billing_question',
                'complaint',
                'praise',
                'escalation_request'
              ],
              confidence_threshold: 0.7
            }
          },
          {
            name: 'Data Enrichment',
            type: 'enricher',
            config: {
              enrichments: [
                'customer_history',
                'product_preferences',
                'interaction_patterns'
              ]
            }
          },
          {
            name: 'Response Generation',
            type: 'response_generator',
            config: {
              use_sentiment: true,
              use_intent: true,
              use_history: true,
              response_templates: true
            }
          }
        ],
        error_handling: {
          retry_attempts: 3,
          fallback_response: 'I apologize, but I\'m experiencing technical difficulties. Please try again or contact support.',
          log_errors: true
        },
        performance: {
          timeout_seconds: 30,
          max_concurrent_requests: 100,
          cache_responses: true
        }
      }),
      status: 'active'
    }
    
    let pipeline
    try {
      pipeline = await makeApiCall('/prisma/pipelines', 'POST', pipelineConfig)
    } catch (apiError: any) {
      if (demoMode.value) {
        await new Promise(resolve => setTimeout(resolve, 600)) // Simulate API call
        pipeline = { data: { id: `demo-pipeline-${Date.now()}` } }
      } else {
        throw apiError
      }
    }
    
    loadingSteps.value[2].completed = true
    loadingSteps.value[2].current = false
    const pipelineId = pipeline.data.id
    
    // Step 4: Create Analytics Dashboard
    loadingSteps.value[3].current = true
    const analyticsConfig = {
      name: 'Customer Analytics Dashboard',
      description: 'Real-time analytics dashboard for monitoring customer interactions and bot performance',
      config: JSON.stringify({
        metrics: [
          {
            name: 'Total Interactions',
            type: 'counter',
            query: 'SELECT COUNT(*) FROM interactions WHERE DATE(created_at) = CURDATE()',
            refresh_interval: 60
          },
          {
            name: 'Average Response Time',
            type: 'gauge',
            query: 'SELECT AVG(response_time) FROM interactions WHERE DATE(created_at) = CURDATE()',
            refresh_interval: 60
          },
          {
            name: 'Customer Satisfaction',
            type: 'percentage',
            query: 'SELECT (COUNT(CASE WHEN sentiment_score > 0.1 THEN 1 END) * 100.0 / COUNT(*)) FROM interactions WHERE DATE(created_at) = CURDATE()',
            refresh_interval: 300
          },
          {
            name: 'Top Intents',
            type: 'bar_chart',
            query: 'SELECT intent, COUNT(*) as count FROM interactions WHERE DATE(created_at) = CURDATE() GROUP BY intent ORDER BY count DESC LIMIT 5',
            refresh_interval: 300
          },
          {
            name: 'Language Distribution',
            type: 'pie_chart',
            query: 'SELECT language, COUNT(*) as count FROM interactions WHERE DATE(created_at) = CURDATE() GROUP BY language',
            refresh_interval: 600
          }
        ],
        alerts: [
          {
            name: 'High Response Time',
            condition: 'response_time > 10',
            threshold: 10,
            action: 'send_notification'
          },
          {
            name: 'Low Satisfaction',
            condition: 'satisfaction_score < 0.6',
            threshold: 0.6,
            action: 'escalate_to_supervisor'
          },
          {
            name: 'High Error Rate',
            condition: 'error_rate > 0.05',
            threshold: 0.05,
            action: 'restart_service'
          }
        ],
        dashboard_layout: {
          theme: 'light',
          refresh_rate: 30,
          auto_refresh: true,
          export_enabled: true
        }
      }),
      status: 'active'
    }
    
    let analytics
    try {
      analytics = await makeApiCall('/prisma/pipelines', 'POST', analyticsConfig)
    } catch (apiError: any) {
      if (demoMode.value) {
        await new Promise(resolve => setTimeout(resolve, 400)) // Simulate API call
        analytics = { data: { id: `demo-analytics-${Date.now()}` } }
      } else {
        throw apiError
      }
    }
    
    loadingSteps.value[3].completed = true
    loadingSteps.value[3].current = false
    const analyticsId = analytics.data.id
    
    // Step 5: Finalize
    loadingSteps.value[4].current = true
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate finalization
    loadingSteps.value[4].completed = true
    loadingSteps.value[4].current = false
    
    // Set results
    results.value = {
      projectId,
      botId,
      pipelineId,
      analyticsId,
      projectName: config.projectName
    }
    
  } catch (err: any) {
    error.value = err.message || 'Failed to create reference project'
    console.error('Error creating reference project:', err)
  } finally {
    loading.value = false
  }
}

// Reset form
function resetForm() {
  config.baseUrl = 'http://localhost:3000'
  config.apiBase = 'http://localhost:3000/api'
  config.projectName = 'AI-Powered Chatbot'
  config.botName = 'Customer Service Assistant'
  config.description = 'Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard.'
  
  error.value = ''
  results.value = null
  demoMode.value = false
}

// Create another project
function createAnother() {
  results.value = null
  error.value = ''
  demoMode.value = false
}

// Retry creation
function retryCreation() {
  error.value = ''
  demoMode.value = false
  createReferenceProject()
}
</script>

<style scoped>
.reference-project-template-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  color: white !important;
  margin-bottom: 1rem;
}

.subtitle {
  color: white !important;
  font-size: 1.1rem;
}

.content-container {
  display: flex;
  justify-content: center;
}

.template-content {
  width: 100%;
  max-width: 800px;
}

.project-overview {
  display: grid;
  gap: 1.5rem;
}

.overview-item h3 {
  color: var(--v-primary-base);
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.overview-item ul {
  margin: 0;
  padding-left: 1.5rem;
}

.overview-item li {
  margin-bottom: 0.25rem;
  color: var(--v-text-secondary);
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.loading-steps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.loading-step {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: var(--v-surface-variant);
}

.results-details h3 {
  color: var(--v-primary-base);
  margin: 1.5rem 0 0.5rem 0;
  font-size: 1.1rem;
}

.results-details ul {
  margin: 0 0 1rem 0;
  padding-left: 1.5rem;
}

.results-details li {
  margin-bottom: 0.25rem;
  color: var(--v-text-secondary);
}

.results-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .reference-project-template-page {
    padding: 1rem;
  }
  
  .action-buttons,
  .results-actions {
    flex-direction: column;
  }
  
  .action-buttons .v-btn,
  .results-actions .v-btn {
    width: 100%;
  }
}
</style> 