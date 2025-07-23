<template>
  <div>
    <PageStructure
      title="Test Bot"
      subtitle="Test your trained bots with conversation scenarios"
      back-button-to="/bots"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Bot Selection -->
        <v-card class="mb-4">
          <v-card-title>Select Bot to Test</v-card-title>
          <v-divider />
          <v-card-text>
            <v-select
              v-model="selectedBot"
              :items="availableBots"
              item-title="name"
              item-value="id"
              label="Choose a Bot"
              variant="outlined"
              class="mb-3"
              :loading="loadingBots"
              :disabled="loadingBots"
              prepend-icon="mdi-robot"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props">
                  <template #prepend>
                    <v-avatar color="primary" size="32">
                      <v-icon color="white">
                        {{ getBotIcon(getBotTypeForDisplay(item.raw)) }}
                      </v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ getBotTypeForDisplay(item.raw) }} • {{ item.raw.status }}
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-select>
            
            <v-alert
              v-if="selectedBotInfo"
              type="info"
              variant="tonal"
              class="mb-3"
            >
              <strong>Bot Info:</strong> {{ getBotTypeForDisplay(selectedBotInfo) }} bot with {{ selectedBotInfo.status }} status
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Test Configuration -->
        <v-card v-if="selectedBot" class="mb-4">
          <v-card-title>Test Configuration</v-card-title>
          <v-divider />
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="testScenario"
                  :items="testScenarios"
                  item-title="name"
                  item-value="id"
                  label="Test Scenario"
                  variant="outlined"
                  class="mb-3"
                  prepend-icon="mdi-chat-question"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="maxTokens"
                  label="Max Tokens"
                  type="number"
                  min="1"
                  max="4096"
                  variant="outlined"
                  class="mb-3"
                  prepend-icon="mdi-text"
                />
              </v-col>
            </v-row>
            
            <v-textarea
              v-model="customMessage"
              label="Custom Message (optional)"
              variant="outlined"
              rows="3"
              class="mb-3"
              placeholder="Enter a custom message to test the bot..."
              prepend-icon="mdi-message-text"
            />
            
            <div class="d-flex gap-3">
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-play"
                :loading="testing"
                :disabled="!selectedBot || !testScenario"
                size="large"
                @click="startTest"
              >
                Start Test
              </v-btn>
              <v-btn
                color="secondary"
                variant="outlined"
                prepend-icon="mdi-refresh"
                :disabled="testing"
                size="large"
                @click="clearTest"
              >
                Clear Test
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Test Results -->
        <v-card v-if="testResults.length > 0">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Test Results</span>
            <v-chip color="success" size="small">
              {{ testResults.length }} test{{ testResults.length > 1 ? 's' : '' }}
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <div v-for="(result, index) in testResults" :key="index" class="mb-4">
              <v-card variant="outlined" class="mb-3">
                <v-card-title class="text-subtitle-1">
                  Test #{{ index + 1 }} - {{ result.scenario }}
                  <v-chip
                    :color="result.success ? 'success' : 'error'"
                    size="small"
                    class="ml-2"
                  >
                    {{ result.success ? 'Success' : 'Error' }}
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <div class="mb-3">
                    <strong>Bot:</strong> {{ result.botName }}
                  </div>
                  
                  <div class="mb-3">
                    <strong>Conversation:</strong>
                    <div class="conversation-container mt-2">
                      <div v-for="(message, msgIndex) in result.conversation" :key="msgIndex" class="message-item mb-2">
                        <div :class="message.role === 'user' ? 'user-message' : 'bot-message'">
                          <v-icon size="16" class="mr-2">
                            {{ message.role === 'user' ? 'mdi-account' : 'mdi-robot' }}
                          </v-icon>
                          <span class="font-weight-medium">{{ message.role === 'user' ? 'You' : 'Bot' }}:</span>
                          <span class="ml-2">{{ message.content }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="result.error" class="mb-3">
                    <strong>Error:</strong>
                    <div class="text-body-2 bg-red-lighten-5 p-2 rounded mt-1">
                      {{ result.error }}
                    </div>
                  </div>
                  
                  <div class="d-flex gap-4 text-caption text-medium-emphasis">
                    <span>
                      <v-icon size="16" class="mr-1">mdi-clock</v-icon>
                      {{ result.duration }}ms
                    </span>
                    <span>
                      <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                      {{ formatDate(result.timestamp) }}
                    </span>
                    <span>
                      <v-icon size="16" class="mr-1">mdi-message-text</v-icon>
                      {{ result.conversation.length }} messages
                    </span>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>

        <!-- Error Alert -->
        <v-alert v-if="error" type="error" class="mt-4">
          {{ error }}
        </v-alert>
      </template>

      <template #sidebar>
        <BotGuide page="test" />
        
        <v-card class="mb-4">
          <v-card-title>Test Settings</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Test Scenarios
                </v-list-item-title>
                <v-list-item-subtitle>Predefined conversation flows</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Max Tokens
                </v-list-item-title>
                <v-list-item-subtitle>Maximum response length (1-4096)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Custom Messages
                </v-list-item-title>
                <v-list-item-subtitle>Test with your own input</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Bot Status
                </v-list-item-title>
                <v-list-item-subtitle>Only active bots can be tested</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Quick Actions</v-card-title>
          <v-card-text>
            <v-btn
              to="/bots"
              color="primary"
              variant="outlined"
              block
              class="mb-2"
              prepend-icon="mdi-arrow-left"
            >
              Back to Bots
            </v-btn>
            <v-btn
              to="/bots/builder"
              color="success"
              variant="outlined"
              block
              class="mb-2"
              prepend-icon="mdi-plus"
            >
              Create New Bot
            </v-btn>
            <v-btn
              to="/bots"
              color="secondary"
              variant="outlined"
              block
              prepend-icon="mdi-robot"
            >
              Manage Bots
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import BotGuide from '~/components/step-guides/BotGuide.vue'

interface Bot {
  id: number
  name: string
  description?: string
  config: string
  status: string
  createdAt: Date
  updatedAt: Date
}

interface TestScenario {
  id: string
  name: string
  messages: string[]
  description: string
}

interface TestResult {
  botId: number
  botName: string
  scenario: string
  conversation: Array<{ role: 'user' | 'bot'; content: string }>
  success: boolean
  error?: string
  duration: number
  timestamp: string
}

const availableBots = ref<Bot[]>([])
const selectedBot = ref<number | null>(null)
const testScenario = ref<string>('')
const customMessage = ref('')
const maxTokens = ref(150)
const testing = ref(false)
const error = ref<string | null>(null)
const testResults = ref<TestResult[]>([])
const loadingBots = ref(false)

// Test scenarios
const testScenarios = ref<TestScenario[]>([
  {
    id: 'greeting',
    name: 'Greeting Test',
    messages: ['Hello', 'How are you?', 'What can you help me with?'],
    description: 'Basic greeting and introduction test'
  },
  {
    id: 'help',
    name: 'Help Request',
    messages: ['I need help', 'Can you assist me?', 'What are your capabilities?'],
    description: 'Test bot\'s help and assistance capabilities'
  },
  {
    id: 'technical',
    name: 'Technical Question',
    messages: ['How do I deploy a model?', 'What is the best framework?', 'Explain machine learning'],
    description: 'Test technical knowledge and explanations'
  },
  {
    id: 'conversation',
    name: 'Conversation Flow',
    messages: ['Tell me a joke', 'That was funny', 'What else can you do?'],
    description: 'Test conversation flow and engagement'
  },
  {
    id: 'custom',
    name: 'Custom Message',
    messages: [],
    description: 'Test with your own custom message'
  }
])

// Computed properties
const selectedBotInfo = computed(() => {
  return availableBots.value.find(bot => bot.id === selectedBot.value)
})

const currentScenario = computed(() => {
  return testScenarios.value.find(scenario => scenario.id === testScenario.value)
})

// Helper functions
const getBotIcon = (type?: string) => {
  const icons: Record<string, string> = {
    'Customer Support': 'mdi-headset',
    'Developer Assistant': 'mdi-code-braces',
    'Data Analyst': 'mdi-chart-line',
    'Content Writer': 'mdi-pencil',
    'General': 'mdi-robot'
  }
  return icons[type || ''] || 'mdi-robot'
}

// Helper function to extract bot type from config
const getBotType = (bot: Bot): string => {
  try {
    const config = JSON.parse(bot.config)
    return config.model || config.type || 'General'
  } catch {
    return 'General'
  }
}

// Helper function to get bot type for display
const getBotTypeForDisplay = (bot: Bot): string => {
  const type = getBotType(bot)
  const typeMap: Record<string, string> = {
    'gpt-4': 'AI Assistant',
    'gpt-3.5-turbo': 'AI Assistant',
    'claude-3-opus': 'AI Assistant',
    'claude-3-sonnet': 'AI Assistant',
    'claude-3-haiku': 'AI Assistant',
    'Customer Support': 'Customer Support',
    'Developer Assistant': 'Developer Assistant',
    'Data Analyst': 'Data Analyst',
    'Content Writer': 'Content Writer',
    'General': 'General'
  }
  return typeMap[type] || 'General'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Action handlers
const startTest = async () => {
  if (!selectedBot.value || !testScenario.value) return
  
  testing.value = true
  error.value = null
  
  const startTime = Date.now()
  
  try {
    const bot = selectedBotInfo.value
    const scenario = currentScenario.value
    
    if (!bot || !scenario) {
      throw new Error('Invalid bot or scenario selection')
    }
    
    // Simulate bot testing
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    const duration = Date.now() - startTime
    
    // Generate conversation based on scenario
    const conversation: Array<{ role: 'user' | 'bot'; content: string }> = []
    const messages = scenario.id === 'custom' && customMessage.value 
      ? [customMessage.value] 
      : scenario.messages
    
    let success = true
    let testError: string | undefined = undefined
    
    if (Math.random() > 0.1) { // 90% success rate
      for (const message of messages) {
        conversation.push({ role: 'user', content: message })
        
        // Generate bot response
        const botResponse = generateBotResponse(message, getBotTypeForDisplay(bot))
        conversation.push({ role: 'bot', content: botResponse })
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } else {
      success = false
      testError = 'Bot response failed: Connection timeout'
      conversation.push({ role: 'user', content: messages[0] || 'Hello' })
    }
    
    const result: TestResult = {
      botId: bot.id,
      botName: bot.name,
      scenario: scenario.name,
      conversation,
      success,
      error: testError,
      duration,
      timestamp: new Date().toISOString()
    }
    
    testResults.value.unshift(result)
    
    // Clear custom message for next test
    customMessage.value = ''
    
  } catch (err) {
    error.value = 'Failed to test bot'
  } finally {
    testing.value = false
  }
}

const generateBotResponse = (userMessage: string, botName: string): string => {
  const responses: Record<string, string[]> = {
    'Customer Support': [
      'I\'m here to help! How can I assist you today?',
      'Thank you for reaching out. Let me help you with that.',
      'I understand your concern. Here\'s what I can do to help.',
      'I\'m sorry to hear that. Let me guide you through the solution.'
    ],
    'Developer Assistant': [
      'I can help you with coding questions and technical issues.',
      'Let me explain that concept in detail.',
      'Here\'s the code example you requested.',
      'I\'ll help you debug that issue step by step.'
    ],
    'Data Analyst': [
      'I can help you analyze your data and create insights.',
      'Let me break down those metrics for you.',
      'Here\'s what the data is telling us.',
      'I\'ll help you visualize that information.'
    ],
    'Content Writer': [
      'I can help you create engaging content.',
      'Let me help you craft that message.',
      'Here\'s a draft for your content.',
      'I\'ll help you improve your writing.'
    ],
    'General': [
      'I\'m here to help with any questions you have.',
      'That\'s an interesting question. Let me explain.',
      'I can assist you with that.',
      'Let me help you find the information you need.'
    ]
  }
  
  const botResponses = responses[botName] || responses['General']
  return botResponses[Math.floor(Math.random() * botResponses.length)]
}

const clearTest = () => {
  testResults.value = []
  error.value = null
  customMessage.value = ''
}

// Load available bots
const loadBots = async () => {
  loadingBots.value = true
  error.value = null
  
  try {
    const response = await $fetch<{ success: boolean; data: Bot[]; message?: string }>('/api/prisma/bots')
    
    if (response.success) {
      availableBots.value = response.data || []
    } else {
      error.value = response.message || 'Failed to load bots'
    }
  } catch (err: any) {
    console.error('Error loading bots:', err)
    error.value = err.message || 'Failed to load bots'
  } finally {
    loadingBots.value = false
  }
}

onMounted(() => {
  loadBots()
})
</script>

<style scoped>
.conversation-container {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.message-item {
  margin-bottom: 0.5rem;
}

.user-message {
  display: flex;
  align-items: flex-start;
  color: var(--v-primary-base);
}

.bot-message {
  display: flex;
  align-items: flex-start;
  color: var(--v-secondary-base);
}

.v-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Ensure list items are black */
:deep(.v-list) {
  color: black !important;
}

:deep(.v-list-item) {
  color: black !important;
}

:deep(.v-list-item-title) {
  color: black !important;
}

:deep(.v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.7) !important;
}

:deep(.v-list-item__content) {
  color: black !important;
}

/* Ensure all list elements are black */
:deep(.v-list *) {
  color: black !important;
}

/* Ensure card titles and text are black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}
</style> 