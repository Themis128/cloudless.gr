<template>
  <div class="documentation-page">
    <PageStructure
      title="Bot Builder Documentation"
      subtitle="Complete guide to creating AI-powered bots with Cloudless.gr"
      :show-back-button="true"
      back-button-to="/documentation"
    >
      <template #main>
        <div class="documentation-content">
          <!-- Quick Navigation -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h6 bg-primary text-white">
              <v-icon class="mr-2">mdi-map</v-icon>
              Quick Navigation
            </v-card-title>
            <v-card-text class="pa-4">
              <v-row>
                <v-col
                  v-for="section in quickNav"
                  :key="section.id"
                  cols="12"
                  sm="6"
                  md="4"
                >
                  <v-btn
                    :to="section.link"
                    variant="outlined"
                    class="w-100 text-left justify-start"
                    :prepend-icon="section.icon"
                  >
                    {{ section.title }}
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Getting Started Section -->
          <div id="getting-started" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-rocket-launch</v-icon>
              Getting Started with Bot Builder
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-text>
                <p class="text-body-1 mb-4">
                  The Cloudless.gr Bot Builder is a powerful visual tool that lets you create sophisticated AI chatbots 
                  without writing code. Whether you're building a customer support bot, a personal assistant, or a 
                  specialized domain expert, our platform provides all the tools you need.
                </p>
                
                <div class="feature-grid">
                  <div
                    v-for="feature in gettingStartedFeatures"
                    :key="feature.title"
                    class="feature-item"
                  >
                    <v-icon :color="feature.color" size="32" class="mb-2">
                      {{ feature.icon }}
                    </v-icon>
                    <h4 class="text-h6 mb-2">{{ feature.title }}</h4>
                    <p class="text-body-2">{{ feature.description }}</p>
                  </div>
                </div>
              </v-card-text>
            </v-card>

            <!-- Quick Start Steps -->
            <v-card class="mb-6" elevation="1">
              <v-card-title class="text-h6">
                <v-icon class="mr-2">mdi-play-circle</v-icon>
                Quick Start Guide
              </v-card-title>
              <v-card-text>
                <v-stepper
                  v-model="currentStep"
                  :items="quickStartSteps"
                  hide-actions
                  class="elevation-0"
                >
                  <template #item.1>
                    <div class="pa-4">
                      <h4 class="text-h6 mb-2">Create Your First Bot</h4>
                      <p class="mb-3">Start by navigating to the Bot Builder and clicking "Create New Bot".</p>
                      <v-btn
                        to="/bots/builder"
                        color="primary"
                        variant="elevated"
                        prepend-icon="mdi-plus"
                      >
                        Start Building
                      </v-btn>
                    </div>
                  </template>
                  
                  <template #item.2>
                    <div class="pa-4">
                      <h4 class="text-h6 mb-2">Configure Bot Settings</h4>
                      <p class="mb-3">Set up your bot's personality, knowledge base, and response style.</p>
                      <ul class="ml-4">
                        <li>Choose AI model (GPT-4, Claude, etc.)</li>
                        <li>Define personality traits</li>
                        <li>Set response parameters</li>
                      </ul>
                    </div>
                  </template>
                  
                  <template #item.3>
                    <div class="pa-4">
                      <h4 class="text-h6 mb-2">Train and Test</h4>
                      <p class="mb-3">Upload training data and test your bot's responses.</p>
                      <v-btn
                        to="/bots/test"
                        color="info"
                        variant="outlined"
                        prepend-icon="mdi-play"
                      >
                        Test Bot
                      </v-btn>
                    </div>
                  </template>
                  
                  <template #item.4>
                    <div class="pa-4">
                      <h4 class="text-h6 mb-2">Deploy and Monitor</h4>
                      <p class="mb-3">Deploy your bot and monitor its performance in real-time.</p>
                      <v-btn
                        to="/bots/manage"
                        color="success"
                        variant="outlined"
                        prepend-icon="mdi-cloud-upload"
                      >
                        Manage Bots
                      </v-btn>
                    </div>
                  </template>
                </v-stepper>
              </v-card-text>
            </v-card>
          </div>

          <!-- Bot Types Section -->
          <div id="bot-types" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-robot-outline</v-icon>
              Bot Types and Use Cases
            </h2>
            
            <v-row>
              <v-col
                v-for="botType in botTypes"
                :key="botType.title"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card class="h-100" elevation="2">
                  <v-card-title class="text-h6">
                    <v-icon :color="botType.color" class="mr-2">
                      {{ botType.icon }}
                    </v-icon>
                    {{ botType.title }}
                  </v-card-title>
                  <v-card-text>
                    <p class="mb-3">{{ botType.description }}</p>
                    <div class="use-cases">
                      <h4 class="text-subtitle-2 mb-2">Common Use Cases:</h4>
                      <v-chip
                        v-for="useCase in botType.useCases"
                        :key="useCase"
                        size="small"
                        class="mr-1 mb-1"
                        variant="outlined"
                      >
                        {{ useCase }}
                      </v-chip>
                    </div>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      :to="botType.templateLink"
                      color="primary"
                      variant="text"
                      size="small"
                    >
                      View Template
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <!-- Advanced Features Section -->
          <div id="advanced-features" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-cog</v-icon>
              Advanced Features
            </h2>
            
            <v-expansion-panels class="mb-4" multiple>
              <v-expansion-panel
                v-for="feature in advancedFeatures"
                :key="feature.title"
                :title="feature.title"
                :text="feature.description"
              >
                <template #title>
                  <div class="d-flex align-center">
                    <v-icon :color="feature.color" class="mr-3">
                      {{ feature.icon }}
                    </v-icon>
                    <span class="text-h6">{{ feature.title }}</span>
                  </div>
                </template>
                
                <template #text>
                  <div class="pa-4">
                    <p class="mb-4">{{ feature.description }}</p>
                    
                    <div v-if="feature.codeExample" class="mb-4">
                      <h4 class="text-subtitle-1 mb-2">Example Configuration:</h4>
                      <v-code class="code-block">{{ feature.codeExample }}</v-code>
                    </div>
                    
                    <div v-if="feature.benefits">
                      <h4 class="text-subtitle-1 mb-2">Benefits:</h4>
                      <ul>
                        <li v-for="benefit in feature.benefits" :key="benefit">
                          {{ benefit }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- Integration Guide Section -->
          <div id="integrations" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-connection</v-icon>
              Integrations and API
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-text>
                <p class="text-body-1 mb-4">
                  Integrate your bots with external services and platforms to extend their capabilities.
                </p>
                
                <v-row>
                  <v-col
                    v-for="integration in integrations"
                    :key="integration.name"
                    cols="12"
                    sm="6"
                    md="4"
                  >
                    <div class="integration-card">
                      <v-icon :color="integration.color" size="48" class="mb-2">
                        {{ integration.icon }}
                      </v-icon>
                      <h4 class="text-h6 mb-2">{{ integration.name }}</h4>
                      <p class="text-body-2 mb-3">{{ integration.description }}</p>
                      <v-btn
                        :href="integration.docsLink"
                        size="small"
                        variant="outlined"
                        target="_blank"
                      >
                        View Docs
                      </v-btn>
                    </div>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </div>

          <!-- Best Practices Section -->
          <div id="best-practices" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-lightbulb</v-icon>
              Best Practices
            </h2>
            
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              Follow these guidelines to create effective and engaging bots.
            </v-alert>
            
            <v-row>
              <v-col
                v-for="practice in bestPractices"
                :key="practice.title"
                cols="12"
                md="6"
              >
                <v-card class="h-100" elevation="1">
                  <v-card-title class="text-h6">
                    <v-icon :color="practice.color" class="mr-2">
                      {{ practice.icon }}
                    </v-icon>
                    {{ practice.title }}
                  </v-card-title>
                  <v-card-text>
                    <ul>
                      <li
                        v-for="tip in practice.tips"
                        :key="tip"
                        class="mb-2"
                      >
                        {{ tip }}
                      </li>
                    </ul>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <!-- Troubleshooting Section -->
          <div id="troubleshooting" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-help-circle</v-icon>
              Troubleshooting
            </h2>
            
            <v-expansion-panels>
              <v-expansion-panel
                v-for="issue in troubleshootingIssues"
                :key="issue.question"
                :title="issue.question"
              >
                <template #text>
                  <div class="pa-4">
                    <p class="mb-3">{{ issue.answer }}</p>
                    <div v-if="issue.solution" class="solution-box">
                      <h4 class="text-subtitle-1 mb-2">Solution:</h4>
                      <div class="solution-content">
                        {{ issue.solution }}
                      </div>
                    </div>
                  </div>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- Resources Section -->
          <div id="resources" class="section">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-book-open</v-icon>
              Additional Resources
            </h2>
            
            <v-row>
              <v-col
                v-for="resource in resources"
                :key="resource.title"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card class="h-100" elevation="2" :to="resource.link">
                  <v-card-title class="text-h6">
                    <v-icon :color="resource.color" class="mr-2">
                      {{ resource.icon }}
                    </v-icon>
                    {{ resource.title }}
                  </v-card-title>
                  <v-card-text>
                    <p>{{ resource.description }}</p>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      :to="resource.link"
                      color="primary"
                      variant="text"
                    >
                      Learn More
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </div>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'

// Set page meta
useHead({
  title: 'Bot Builder Documentation - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Complete guide to creating AI-powered bots with Cloudless.gr Bot Builder. Learn to build, train, and deploy intelligent chatbots.' },
    { property: 'og:title', content: 'Bot Builder Documentation - Cloudless.gr' },
    { property: 'og:description', content: 'Complete guide to creating AI-powered bots with Cloudless.gr Bot Builder.' }
  ]
})

// Reactive data
const currentStep = ref(1)

// Quick navigation items
const quickNav = [
  { id: 'getting-started', title: 'Getting Started', link: '#getting-started', icon: 'mdi-rocket-launch' },
  { id: 'bot-types', title: 'Bot Types', link: '#bot-types', icon: 'mdi-robot-outline' },
  { id: 'advanced-features', title: 'Advanced Features', link: '#advanced-features', icon: 'mdi-cog' },
  { id: 'integrations', title: 'Integrations', link: '#integrations', icon: 'mdi-connection' },
  { id: 'best-practices', title: 'Best Practices', link: '#best-practices', icon: 'mdi-lightbulb' },
  { id: 'troubleshooting', title: 'Troubleshooting', link: '#troubleshooting', icon: 'mdi-help-circle' }
]

// Getting started features
const gettingStartedFeatures = [
  {
    title: 'Visual Builder',
    description: 'Drag-and-drop interface for creating bot flows without coding',
    icon: 'mdi-view-dashboard',
    color: 'primary'
  },
  {
    title: 'AI Models',
    description: 'Choose from GPT-4, Claude, and other leading AI models',
    icon: 'mdi-brain',
    color: 'secondary'
  },
  {
    title: 'Real-time Testing',
    description: 'Test your bot instantly as you build with live preview',
    icon: 'mdi-play-circle',
    color: 'success'
  },
  {
    title: 'Easy Deployment',
    description: 'Deploy to multiple platforms with one-click integration',
    icon: 'mdi-rocket',
    color: 'warning'
  }
]

// Quick start steps
const quickStartSteps = [
  { title: 'Create Bot', value: '1' },
  { title: 'Configure', value: '2' },
  { title: 'Train & Test', value: '3' },
  { title: 'Deploy', value: '4' }
]

// Bot types
const botTypes = [
  {
    title: 'Customer Support Bot',
    description: 'Handle customer inquiries, provide instant responses, and escalate complex issues to human agents.',
    icon: 'mdi-headset',
    color: 'primary',
    useCases: ['FAQ Responses', 'Ticket Creation', 'Live Chat', 'Order Status'],
    templateLink: '/bots/templates/customer-support'
  },
  {
    title: 'Personal Assistant',
    description: 'Create intelligent assistants that help users manage tasks, schedules, and personal information.',
    icon: 'mdi-account-tie',
    color: 'secondary',
    useCases: ['Calendar Management', 'Task Reminders', 'Email Sorting', 'Research'],
    templateLink: '/bots/templates/personal-assistant'
  },
  {
    title: 'E-commerce Bot',
    description: 'Guide customers through product discovery, recommendations, and purchase processes.',
    icon: 'mdi-cart',
    color: 'success',
    useCases: ['Product Recommendations', 'Order Processing', 'Inventory Queries', 'Returns'],
    templateLink: '/bots/templates/ecommerce'
  },
  {
    title: 'Educational Bot',
    description: 'Create tutoring bots that provide personalized learning experiences and answer student questions.',
    icon: 'mdi-school',
    color: 'info',
    useCases: ['Q&A Sessions', 'Quiz Generation', 'Progress Tracking', 'Study Plans'],
    templateLink: '/bots/templates/educational'
  },
  {
    title: 'HR Assistant',
    description: 'Streamline HR processes with bots that handle employee queries and administrative tasks.',
    icon: 'mdi-account-group',
    color: 'warning',
    useCases: ['Leave Requests', 'Policy Questions', 'Onboarding', 'Performance Reviews'],
    templateLink: '/bots/templates/hr-assistant'
  },
  {
    title: 'Technical Support',
    description: 'Provide technical troubleshooting and guide users through complex problem-solving processes.',
    icon: 'mdi-tools',
    color: 'error',
    useCases: ['Troubleshooting', 'Documentation', 'Bug Reports', 'Feature Requests'],
    templateLink: '/bots/templates/technical-support'
  }
]

// Advanced features
const advancedFeatures = [
  {
    title: 'Context Memory',
    description: 'Enable bots to remember conversation history and maintain context across multiple interactions.',
    icon: 'mdi-memory',
    color: 'primary',
    benefits: [
      'Maintain conversation flow',
      'Personalized responses based on history',
      'Reduced need for users to repeat information'
    ],
    codeExample: `{
  "memory": {
    "type": "conversation",
    "retention": "30_days",
    "max_context": 4000
  }
}`
  },
  {
    title: 'Custom Actions',
    description: 'Create custom functions that your bot can execute, such as API calls, database queries, or file operations.',
    icon: 'mdi-function-variant',
    color: 'secondary',
    benefits: [
      'Extend bot capabilities beyond chat',
      'Integrate with external systems',
      'Automate complex workflows'
    ],
    codeExample: `{
  "actions": {
    "get_weather": {
      "type": "api_call",
      "endpoint": "https://api.weather.com/v1/current",
      "method": "GET"
    }
  }
}`
  },
  {
    title: 'Multi-language Support',
    description: 'Configure your bot to understand and respond in multiple languages with automatic translation.',
    icon: 'mdi-translate',
    color: 'success',
    benefits: [
      'Reach global audiences',
      'Automatic language detection',
      'Consistent responses across languages'
    ]
  },
  {
    title: 'Analytics & Insights',
    description: 'Track bot performance, user satisfaction, and conversation patterns with detailed analytics.',
    icon: 'mdi-chart-line',
    color: 'info',
    benefits: [
      'Monitor bot effectiveness',
      'Identify improvement opportunities',
      'Track user engagement metrics'
    ]
  }
]

// Integrations
const integrations = [
  {
    name: 'Slack',
    description: 'Deploy your bot directly to Slack workspaces',
    icon: 'mdi-slack',
    color: '#4A154B',
    docsLink: '/documentation/integrations/slack'
  },
  {
    name: 'Discord',
    description: 'Create Discord bots for community management',
    icon: 'mdi-discord',
    color: '#5865F2',
    docsLink: '/documentation/integrations/discord'
  },
  {
    name: 'WhatsApp',
    description: 'Connect to WhatsApp Business API',
    icon: 'mdi-whatsapp',
    color: '#25D366',
    docsLink: '/documentation/integrations/whatsapp'
  },
  {
    name: 'Telegram',
    description: 'Build Telegram bots with rich interactions',
    icon: 'mdi-telegram',
    color: '#0088CC',
    docsLink: '/documentation/integrations/telegram'
  },
  {
    name: 'Website Widget',
    description: 'Embed chat widgets on your website',
    icon: 'mdi-web',
    color: 'primary',
    docsLink: '/documentation/integrations/web-widget'
  },
  {
    name: 'REST API',
    description: 'Integrate with any platform using our API',
    icon: 'mdi-api',
    color: 'secondary',
    docsLink: '/documentation/api-reference'
  }
]

// Best practices
const bestPractices = [
  {
    title: 'Conversation Design',
    icon: 'mdi-chat',
    color: 'primary',
    tips: [
      'Keep responses concise and clear',
      'Use a consistent personality and tone',
      'Provide multiple response options when appropriate',
      'Handle misunderstandings gracefully',
      'Always offer a way to reach human support'
    ]
  },
  {
    title: 'Training Data',
    icon: 'mdi-database',
    color: 'secondary',
    tips: [
      'Use high-quality, relevant training examples',
      'Include diverse conversation scenarios',
      'Regularly update training data based on user interactions',
      'Test with edge cases and unusual inputs',
      'Balance formal and informal language examples'
    ]
  },
  {
    title: 'User Experience',
    icon: 'mdi-account-heart',
    color: 'success',
    tips: [
      'Set clear expectations about bot capabilities',
      'Provide quick response times',
      'Use rich media (images, buttons) when helpful',
      'Implement fallback responses for unknown queries',
      'Make it easy to start over or change topics'
    ]
  },
  {
    title: 'Performance',
    icon: 'mdi-speedometer',
    color: 'warning',
    tips: [
      'Monitor response times and optimize as needed',
      'Use caching for frequently requested information',
      'Implement rate limiting to prevent abuse',
      'Regular performance testing and optimization',
      'Monitor error rates and fix issues promptly'
    ]
  }
]

// Troubleshooting issues
const troubleshootingIssues = [
  {
    question: 'My bot is not responding correctly to user inputs',
    answer: 'This is usually due to insufficient or poor-quality training data. The bot needs diverse examples to understand user intent properly.',
    solution: 'Review and expand your training data with more examples. Test different phrasings of the same intent and ensure your training covers edge cases.'
  },
  {
    question: 'Bot responses are too slow',
    answer: 'Response delays can be caused by complex processing, large context windows, or external API calls.',
    solution: 'Optimize your bot configuration by reducing context window size, simplifying complex logic, and implementing caching for external data.'
  },
  {
    question: 'Users are getting stuck in conversation loops',
    answer: 'This happens when the bot doesn\'t properly handle context transitions or fallback scenarios.',
    solution: 'Implement proper conversation flow management with clear exit conditions and fallback responses for unrecognized inputs.'
  },
  {
    question: 'Bot is not maintaining conversation context',
    answer: 'Context loss occurs when memory settings are not properly configured or when sessions expire.',
    solution: 'Check your memory configuration settings and ensure proper session management. Consider increasing context retention time.'
  },
  {
    question: 'Integration with external platforms is failing',
    answer: 'Integration issues are often related to authentication, API changes, or configuration errors.',
    solution: 'Verify API credentials, check for platform API updates, and review integration configuration settings. Test connections in isolation.'
  }
]

// Resources
const resources = [
  {
    title: 'API Reference',
    description: 'Complete API documentation for bot integration',
    icon: 'mdi-api',
    color: 'primary',
    link: '/api-reference'
  },
  {
    title: 'Video Tutorials',
    description: 'Step-by-step video guides for bot building',
    icon: 'mdi-play-circle',
    color: 'secondary',
    link: '/tutorials'
  },
  {
    title: 'Community Forum',
    description: 'Connect with other bot builders and get help',
    icon: 'mdi-forum',
    color: 'success',
    link: '/community'
  },
  {
    title: 'Bot Templates',
    description: 'Pre-built templates for common use cases',
    icon: 'mdi-file-document-multiple',
    color: 'info',
    link: '/bots/templates'
  },
  {
    title: 'Support Center',
    description: 'Get help from our support team',
    icon: 'mdi-help-circle',
    color: 'warning',
    link: '/support'
  },
  {
    title: 'Blog & Updates',
    description: 'Latest features and best practices',
    icon: 'mdi-newspaper',
    color: 'error',
    link: '/blog'
  }
]
</script>

<style scoped>
.documentation-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.documentation-content {
  max-width: 1200px;
  margin: 0 auto;
}

.section {
  scroll-margin-top: 80px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.feature-item {
  text-align: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.integration-card {
  text-align: center;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  height: 100%;
}

.code-block {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  overflow-x: auto;
}

.solution-box {
  background: #e8f5e8;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #4caf50;
}

.solution-content {
  font-family: monospace;
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  
  .integration-card {
    margin-bottom: 1rem;
  }
}
</style>