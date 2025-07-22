<template>
  <div class="quick-start-page">
    <PageStructure
      title="Bot Builder Quick Start"
      subtitle="Get up and running with your first AI bot in 5 minutes"
      :show-back-button="true"
      back-button-to="/documentation/bots"
    >
      <template #main>
        <div class="quick-start-content">
          <!-- Progress Indicator -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h6 bg-primary text-white">
              <v-icon class="mr-2">mdi-clock-fast</v-icon>
              5-Minute Setup
            </v-card-title>
            <v-card-text class="pa-4">
              <v-progress-linear
                :model-value="progressValue"
                color="primary"
                height="8"
                rounded
                class="mb-3"
              />
              <p class="text-center text-body-2">
                Step {{ currentStep }} of {{ totalSteps }} - {{ currentStepTitle }}
              </p>
            </v-card-text>
          </v-card>

          <!-- Step-by-Step Guide -->
          <v-stepper
            v-model="currentStep"
            :items="steps"
            class="elevation-2"
            @update:model-value="updateProgress"
          >
            <!-- Step 1: Create Bot -->
            <template #item.1>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="primary" class="mb-3">mdi-robot-excited</v-icon>
                  <h2 class="text-h4 mb-2">Create Your Bot</h2>
                  <p class="text-body-1 mb-4">
                    Let's start by creating your first AI bot. This takes just 30 seconds.
                  </p>
                </div>

                <v-alert type="info" variant="tonal" class="mb-4">
                  <template #prepend>
                    <v-icon>mdi-lightbulb</v-icon>
                  </template>
                  <strong>Pro Tip:</strong> Choose a specific use case for your bot to get better results.
                </v-alert>

                <div class="action-section">
                  <h3 class="text-h6 mb-3">Choose Your Bot Type:</h3>
                  <v-row>
                    <v-col
                      v-for="botType in quickBotTypes"
                      :key="botType.type"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <v-card
                        class="bot-type-card h-100"
                        :class="{ 'selected': selectedBotType === botType.type }"
                        elevation="1"
                        @click="selectBotType(botType.type)"
                      >
                        <v-card-text class="text-center">
                          <v-icon :color="botType.color" size="32" class="mb-2">
                            {{ botType.icon }}
                          </v-icon>
                          <h4 class="text-h6 mb-2">{{ botType.title }}</h4>
                          <p class="text-body-2">{{ botType.description }}</p>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>

                  <div class="mt-4">
                    <v-btn
                      color="primary"
                      size="large"
                      :disabled="!selectedBotType"
                      @click="nextStep"
                    >
                      Create {{ selectedBotType ? quickBotTypes.find(t => t.type === selectedBotType)?.title : 'Bot' }}
                      <v-icon right>mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </div>
              </div>
            </template>

            <!-- Step 2: Configure -->
            <template #item.2>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="secondary" class="mb-3">mdi-cog</v-icon>
                  <h2 class="text-h4 mb-2">Configure Settings</h2>
                  <p class="text-body-1 mb-4">
                    Set up your bot's personality and behavior. Don't worry, you can change these later.
                  </p>
                </div>

                <v-form ref="configForm" class="config-form">
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="botConfig.name"
                        label="Bot Name"
                        placeholder="e.g., Support Assistant"
                        prepend-inner-icon="mdi-robot"
                        variant="outlined"
                        :rules="[v => !!v || 'Name is required']"
                        required
                      />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="botConfig.model"
                        :items="aiModels"
                        label="AI Model"
                        prepend-inner-icon="mdi-brain"
                        variant="outlined"
                        :rules="[v => !!v || 'Model is required']"
                        required
                      />
                    </v-col>
                  </v-row>

                  <v-textarea
                    v-model="botConfig.personality"
                    label="Bot Personality"
                    placeholder="Describe how your bot should behave..."
                    prepend-inner-icon="mdi-account-heart"
                    variant="outlined"
                    rows="3"
                    :rules="[v => !!v || 'Personality is required']"
                    required
                  />

                  <v-row>
                    <v-col cols="12" md="6">
                      <v-slider
                        v-model="botConfig.creativity"
                        label="Creativity Level"
                        :min="0"
                        :max="100"
                        :step="10"
                        show-ticks
                        tick-size="4"
                        thumb-label
                        prepend-icon="mdi-palette"
                      >
                        <template #thumb-label="{ modelValue }">
                          {{ modelValue }}%
                        </template>
                      </v-slider>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-slider
                        v-model="botConfig.responseLength"
                        label="Response Length"
                        :min="1"
                        :max="5"
                        :step="1"
                        show-ticks
                        tick-size="4"
                        thumb-label
                        prepend-icon="mdi-text-long"
                      >
                        <template #thumb-label="{ modelValue }">
                          {{ ['Very Short', 'Short', 'Medium', 'Long', 'Very Long'][modelValue - 1] }}
                        </template>
                      </v-slider>
                    </v-col>
                  </v-row>
                </v-form>

                <div class="mt-4">
                  <v-btn
                    color="secondary"
                    size="large"
                    @click="nextStep"
                  >
                    Save Configuration
                    <v-icon right>mdi-arrow-right</v-icon>
                  </v-btn>
                </div>
              </div>
            </template>

            <!-- Step 3: Test -->
            <template #item.3>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="success" class="mb-3">mdi-play-circle</v-icon>
                  <h2 class="text-h4 mb-2">Test Your Bot</h2>
                  <p class="text-body-1 mb-4">
                    Let's test your bot with some sample messages to see how it responds.
                  </p>
                </div>

                <v-card class="chat-simulator mb-4" elevation="1">
                  <v-card-title class="text-h6">
                    <v-icon class="mr-2">mdi-chat</v-icon>
                    Chat Simulator
                  </v-card-title>
                  <v-card-text>
                    <div class="chat-messages" ref="chatMessages">
                      <div
                        v-for="(message, index) in chatMessages"
                        :key="index"
                        class="message"
                        :class="message.type"
                      >
                        <div class="message-avatar">
                          <v-icon :color="message.type === 'user' ? 'primary' : 'secondary'">
                            {{ message.type === 'user' ? 'mdi-account' : 'mdi-robot' }}
                          </v-icon>
                        </div>
                        <div class="message-content">
                          <div class="message-text">{{ message.text }}</div>
                          <div class="message-time">{{ message.time }}</div>
                        </div>
                      </div>
                    </div>

                    <div class="chat-input mt-3">
                      <v-text-field
                        v-model="testMessage"
                        label="Type a test message..."
                        variant="outlined"
                        density="compact"
                        append-inner-icon="mdi-send"
                        @click:append-inner="sendTestMessage"
                        @keyup.enter="sendTestMessage"
                      />
                    </div>

                    <div class="quick-test-buttons mt-3">
                      <h4 class="text-subtitle-1 mb-2">Quick Tests:</h4>
                      <v-btn
                        v-for="testMsg in quickTestMessages"
                        :key="testMsg"
                        size="small"
                        variant="outlined"
                        class="mr-2 mb-2"
                        @click="sendQuickTest(testMsg)"
                      >
                        {{ testMsg }}
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>

                <div class="mt-4">
                  <v-btn
                    color="success"
                    size="large"
                    @click="nextStep"
                  >
                    Bot Works Great!
                    <v-icon right>mdi-arrow-right</v-icon>
                  </v-btn>
                </div>
              </div>
            </template>

            <!-- Step 4: Deploy -->
            <template #item.4>
              <div class="step-content">
                <div class="step-header">
                  <v-icon size="48" color="warning" class="mb-3">mdi-rocket</v-icon>
                  <h2 class="text-h4 mb-2">Deploy Your Bot</h2>
                  <p class="text-body-1 mb-4">
                    Choose where you want to deploy your bot. You can always add more platforms later.
                  </p>
                </div>

                <v-alert type="success" variant="tonal" class="mb-4">
                  <template #prepend>
                    <v-icon>mdi-check-circle</v-icon>
                  </template>
                  <strong>Congratulations!</strong> Your bot is ready to deploy. Choose your preferred platform below.
                </v-alert>

                <v-row>
                  <v-col
                    v-for="platform in deploymentPlatforms"
                    :key="platform.name"
                    cols="12"
                    sm="6"
                    md="4"
                  >
                    <v-card
                      class="deployment-card h-100"
                      elevation="2"
                      :class="{ 'selected': selectedPlatform === platform.name }"
                      @click="selectPlatform(platform.name)"
                    >
                      <v-card-text class="text-center">
                        <v-icon :color="platform.color" size="48" class="mb-2">
                          {{ platform.icon }}
                        </v-icon>
                        <h4 class="text-h6 mb-2">{{ platform.title }}</h4>
                        <p class="text-body-2 mb-3">{{ platform.description }}</p>
                        <v-chip
                          :color="platform.difficulty === 'Easy' ? 'success' : platform.difficulty === 'Medium' ? 'warning' : 'error'"
                          size="small"
                        >
                          {{ platform.difficulty }}
                        </v-chip>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>

                <div class="mt-6 text-center">
                  <v-btn
                    color="warning"
                    size="large"
                    :disabled="!selectedPlatform"
                    @click="deployBot"
                  >
                    <v-icon left>mdi-rocket</v-icon>
                    Deploy to {{ selectedPlatform }}
                  </v-btn>
                </div>
              </div>
            </template>

            <!-- Step 5: Success -->
            <template #item.5>
              <div class="step-content text-center">
                <v-icon size="120" color="success" class="mb-4">mdi-check-circle</v-icon>
                <h2 class="text-h3 mb-4">🎉 Bot Successfully Created!</h2>
                <p class="text-h6 mb-6">
                  Your AI bot is now live and ready to help users. Here's what you can do next:
                </p>

                <v-row class="mb-6">
                  <v-col
                    v-for="nextStep in nextSteps"
                    :key="nextStep.title"
                    cols="12"
                    md="4"
                  >
                    <v-card class="h-100" elevation="2">
                      <v-card-text class="text-center">
                        <v-icon :color="nextStep.color" size="48" class="mb-3">
                          {{ nextStep.icon }}
                        </v-icon>
                        <h4 class="text-h6 mb-2">{{ nextStep.title }}</h4>
                        <p class="text-body-2 mb-3">{{ nextStep.description }}</p>
                        <v-btn
                          :color="nextStep.color"
                          :to="nextStep.link"
                          variant="outlined"
                          size="small"
                        >
                          {{ nextStep.action }}
                        </v-btn>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>

                <div class="action-buttons">
                  <v-btn
                    to="/bots/manage"
                    color="primary"
                    size="large"
                    class="mr-3"
                  >
                    <v-icon left>mdi-cog</v-icon>
                    Manage Bot
                  </v-btn>
                  <v-btn
                    to="/bots/builder"
                    color="secondary"
                    size="large"
                    variant="outlined"
                  >
                    <v-icon left>mdi-plus</v-icon>
                    Create Another Bot
                  </v-btn>
                </div>
              </div>
            </template>
          </v-stepper>

          <!-- Help Section -->
          <v-card class="mt-6" elevation="1">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-help-circle</v-icon>
              Need Help?
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <h4 class="text-subtitle-1 mb-2">Quick Links:</h4>
                  <ul>
                    <li><a href="/documentation/bots" class="text-primary">Full Bot Documentation</a></li>
                    <li><a href="/tutorials" class="text-primary">Video Tutorials</a></li>
                    <li><a href="/api-reference" class="text-primary">API Reference</a></li>
                  </ul>
                </v-col>
                <v-col cols="12" md="6">
                  <h4 class="text-subtitle-1 mb-2">Get Support:</h4>
                  <v-btn
                    to="/support"
                    color="info"
                    variant="outlined"
                    class="mr-2 mb-2"
                  >
                    <v-icon left>mdi-help</v-icon>
                    Support Center
                  </v-btn>
                  <v-btn
                    to="/community"
                    color="success"
                    variant="outlined"
                    class="mb-2"
                  >
                    <v-icon left>mdi-forum</v-icon>
                    Community
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'

// Set page meta
useHead({
  title: 'Bot Builder Quick Start - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Get started with Cloudless.gr Bot Builder in 5 minutes. Create, configure, test, and deploy your first AI bot quickly and easily.' },
    { property: 'og:title', content: 'Bot Builder Quick Start - Cloudless.gr' },
    { property: 'og:description', content: 'Create your first AI bot in just 5 minutes with our step-by-step quick start guide.' }
  ]
})

// Reactive data
const currentStep = ref(1)
const totalSteps = 5
const selectedBotType = ref('')
const selectedPlatform = ref('')
const testMessage = ref('')
const chatMessages = ref([
  {
    type: 'bot',
    text: 'Hi! I\'m your new AI bot. Try sending me a message!',
    time: new Date().toLocaleTimeString()
  }
])

// Bot configuration
const botConfig = ref({
  name: '',
  model: '',
  personality: '',
  creativity: 50,
  responseLength: 3
})

// Computed
const progressValue = computed(() => (currentStep.value / totalSteps) * 100)
const currentStepTitle = computed(() => {
  const titles = ['Create Bot', 'Configure', 'Test', 'Deploy', 'Success']
  return titles[currentStep.value - 1] || ''
})

// Steps configuration
const steps = [
  { title: 'Create', value: '1' },
  { title: 'Configure', value: '2' },
  { title: 'Test', value: '3' },
  { title: 'Deploy', value: '4' },
  { title: 'Success', value: '5' }
]

// Quick bot types
const quickBotTypes = [
  {
    type: 'support',
    title: 'Support Bot',
    description: 'Handle customer questions and support tickets',
    icon: 'mdi-headset',
    color: 'primary'
  },
  {
    type: 'assistant',
    title: 'Assistant Bot',
    description: 'Personal helper for tasks and reminders',
    icon: 'mdi-account-tie',
    color: 'secondary'
  },
  {
    type: 'sales',
    title: 'Sales Bot',
    description: 'Guide customers through sales process',
    icon: 'mdi-cart',
    color: 'success'
  }
]

// AI Models
const aiModels = [
  { title: 'GPT-4 (Recommended)', value: 'gpt-4' },
  { title: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { title: 'Claude 3', value: 'claude-3' },
  { title: 'Llama 2', value: 'llama-2' }
]

// Quick test messages
const quickTestMessages = [
  'Hello!',
  'How can you help me?',
  'What are your capabilities?',
  'Thank you'
]

// Deployment platforms
const deploymentPlatforms = [
  {
    name: 'website',
    title: 'Website Widget',
    description: 'Embed on your website with a simple code snippet',
    icon: 'mdi-web',
    color: 'primary',
    difficulty: 'Easy'
  },
  {
    name: 'slack',
    title: 'Slack',
    description: 'Deploy to your Slack workspace',
    icon: 'mdi-slack',
    color: '#4A154B',
    difficulty: 'Easy'
  },
  {
    name: 'discord',
    title: 'Discord',
    description: 'Create a Discord bot for your server',
    icon: 'mdi-discord',
    color: '#5865F2',
    difficulty: 'Medium'
  }
]

// Next steps after completion
const nextSteps = [
  {
    title: 'Customize Further',
    description: 'Fine-tune your bot\'s responses and add advanced features',
    icon: 'mdi-tune',
    color: 'primary',
    action: 'Customize',
    link: '/bots/builder'
  },
  {
    title: 'Monitor Performance',
    description: 'Track conversations and improve your bot over time',
    icon: 'mdi-chart-line',
    color: 'info',
    action: 'View Analytics',
    link: '/bots/analytics'
  },
  {
    title: 'Add Integrations',
    description: 'Connect your bot to more platforms and services',
    icon: 'mdi-connection',
    color: 'warning',
    action: 'Browse Integrations',
    link: '/documentation/integrations'
  }
]

// Methods
const updateProgress = (step: number) => {
  // Auto-populate some fields based on bot type when moving to step 2
  if (step === 2 && selectedBotType.value) {
    const botType = quickBotTypes.find(t => t.type === selectedBotType.value)
    if (botType && !botConfig.value.name) {
      botConfig.value.name = `${botType.title} Assistant`
      botConfig.value.model = 'gpt-4'
      
      // Set personality based on bot type
      const personalities = {
        support: 'You are a helpful and patient customer support assistant. Always be polite, professional, and aim to resolve customer issues quickly.',
        assistant: 'You are a friendly personal assistant. Help users organize their tasks, provide reminders, and offer helpful suggestions.',
        sales: 'You are an enthusiastic sales assistant. Help customers find the right products and guide them through the purchase process.'
      }
      botConfig.value.personality = personalities[selectedBotType.value as keyof typeof personalities] || ''
    }
  }
}

const selectBotType = (type: string) => {
  selectedBotType.value = type
}

const selectPlatform = (platform: string) => {
  selectedPlatform.value = platform
}

const nextStep = () => {
  if (currentStep.value < totalSteps) {
    currentStep.value++
    updateProgress(currentStep.value)
  }
}

const sendTestMessage = () => {
  if (!testMessage.value.trim()) return

  // Add user message
  chatMessages.value.push({
    type: 'user',
    text: testMessage.value,
    time: new Date().toLocaleTimeString()
  })

  // Simulate bot response
  setTimeout(() => {
    const responses = [
      'Thanks for testing! I understand your message.',
      'That\'s a great question! I\'m here to help.',
      'I appreciate you trying out my capabilities.',
      'I\'m working well and ready to assist users!'
    ]
    
    chatMessages.value.push({
      type: 'bot',
      text: responses[Math.floor(Math.random() * responses.length)],
      time: new Date().toLocaleTimeString()
    })
  }, 1000)

  testMessage.value = ''
}

const sendQuickTest = (message: string) => {
  testMessage.value = message
  sendTestMessage()
}

const deployBot = () => {
  // Simulate deployment process
  nextStep()
}
</script>

<style scoped>
.quick-start-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.quick-start-content {
  max-width: 1000px;
  margin: 0 auto;
}

.step-content {
  padding: 2rem;
}

.step-header {
  text-align: center;
  margin-bottom: 2rem;
}

.bot-type-card,
.deployment-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.bot-type-card:hover,
.deployment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.bot-type-card.selected,
.deployment-card.selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.config-form {
  max-width: 600px;
  margin: 0 auto;
}

.chat-simulator {
  max-width: 600px;
  margin: 0 auto;
}

.chat-messages {
  max-height: 300px;
  overflow-y: auto;
  padding: 1rem 0;
}

.message {
  display: flex;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0.5rem;
}

.message-content {
  max-width: 70%;
}

.message.user .message-content {
  text-align: right;
}

.message-text {
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.message.user .message-text {
  background: rgb(var(--v-theme-primary));
  color: white;
}

.message-time {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
  padding: 0 0.5rem;
}

.quick-test-buttons .v-btn {
  text-transform: none;
}

.action-buttons {
  margin-top: 2rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .step-content {
    padding: 1rem;
  }
  
  .step-header {
    margin-bottom: 1rem;
  }
  
  .config-form,
  .chat-simulator {
    max-width: 100%;
  }
}
</style>