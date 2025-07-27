import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface StepGuide {
  title: string
  content: string
  fullContent: string
  tips: string[]
}

interface TemplateInfo {
  name: string
  description: string
  category?: string
  tags?: string[]
  [key: string]: any
}

type BuilderType = 'bot' | 'model' | 'pipeline' | 'llm'

export const useStepGuidesStore = defineStore('stepGuides', () => {
  // State
  const currentBuilder = ref<BuilderType>('bot')
  const currentStep = ref(0)

  // Bot Builder Step Guides
  const botStepGuides: StepGuide[] = [
    {
      title: 'Bot Details',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🤖 Bot Information</h5>
          <ul class="text-body-2">
            <li><strong>Bot Name:</strong> Choose a descriptive name that clearly identifies your bot's purpose</li>
            <li><strong>Prompt:</strong> Define the bot's personality, role, and behavior instructions</li>
            <li><strong>Description:</strong> Provide a brief overview of what your bot does</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">💡 Best Practices</h5>
          <ul class="text-body-2">
            <li>Use clear, specific names that indicate the bot's function</li>
            <li>Write detailed prompts that define the bot's role and limitations</li>
            <li>Include examples of expected interactions in your prompt</li>
            <li>Consider the target audience when crafting the bot's personality</li>
          </ul>
        </div>
      `,
      fullContent: `
        <div class="mb-4">
          <h4 class="text-h6 font-weight-bold mb-3">Complete Bot Details Guide</h4>
          <p class="text-body-1 mb-3">
            The first step in creating a bot is defining its basic information and personality. This foundation will guide all subsequent configuration decisions.
          </p>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🤖 Bot Name Guidelines</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>Be Descriptive:</strong> The name should immediately convey the bot's purpose</li>
            <li><strong>Keep it Simple:</strong> Avoid overly complex or technical names</li>
            <li><strong>Consider Branding:</strong> Align with your organization's naming conventions</li>
            <li><strong>Make it Memorable:</strong> Choose names that users will easily remember</li>
          </ul>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">📝 Prompt Engineering</h5>
          <p class="text-body-1 mb-2">Your prompt is the foundation of your bot's behavior. A well-crafted prompt should include:</p>
          <ul class="text-body-1 mb-3">
            <li><strong>Role Definition:</strong> Clearly state what the bot is and what it does</li>
            <li><strong>Personality Traits:</strong> Define tone, style, and communication approach</li>
            <li><strong>Capabilities:</strong> List what the bot can and cannot do</li>
            <li><strong>Limitations:</strong> Be clear about what the bot should not attempt</li>
            <li><strong>Examples:</strong> Provide sample interactions to guide behavior</li>
          </ul>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🎯 Use Case Examples</h5>
          <div class="text-body-1">
            <p class="mb-2"><strong>Customer Support Bot:</strong></p>
            <p class="text-body-2 mb-3">"You are a professional customer support representative. Help customers with inquiries, provide accurate information, and ensure satisfaction. Be polite, patient, and helpful."</p>

            <p class="mb-2"><strong>Developer Assistant:</strong></p>
            <p class="text-body-2 mb-3">"You are a coding assistant. Help with code reviews, debugging, and best practices. Provide clear explanations and suggest improvements."</p>
          </div>
        </div>
      `,
      tips: [
        'Start with a clear role definition',
        'Include specific examples in your prompt',
        'Define both capabilities and limitations',
        'Consider the user experience',
      ],
    },
    {
      title: 'Model Selection',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🧠 AI Model Options</h5>
          <ul class="text-body-2">
            <li><strong>GPT-4:</strong> Most capable, best for complex reasoning and creative tasks</li>
            <li><strong>GPT-3.5:</strong> Good balance of performance and cost for most use cases</li>
            <li><strong>Claude:</strong> Excellent for analysis and writing tasks</li>
            <li><strong>Custom Models:</strong> Specialized models for specific domains</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">💡 Selection Tips</h5>
          <ul class="text-body-2">
            <li>Consider your use case and budget</li>
            <li>Test different models for your specific needs</li>
            <li>Balance performance with cost</li>
            <li>Consider response time requirements</li>
          </ul>
        </div>
      `,
      fullContent: `
        <div class="mb-4">
          <h4 class="text-h6 font-weight-bold mb-3">Complete Model Selection Guide</h4>
          <p class="text-body-1 mb-3">
            Choosing the right AI model is crucial for your bot's performance. Consider factors like capability, cost, and response time.
          </p>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🧠 Model Capabilities</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>GPT-4:</strong> Advanced reasoning, creative tasks, complex problem solving</li>
            <li><strong>GPT-3.5:</strong> General purpose, good performance, cost-effective</li>
            <li><strong>Claude:</strong> Analysis, writing, research tasks</li>
            <li><strong>Custom Models:</strong> Domain-specific expertise</li>
          </ul>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">💰 Cost Considerations</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>Token Usage:</strong> More capable models cost more per token</li>
            <li><strong>Response Length:</strong> Longer responses increase costs</li>
            <li><strong>Usage Volume:</strong> High-volume applications need cost optimization</li>
            <li><strong>Budget Planning:</strong> Estimate costs based on expected usage</li>
          </ul>
        </div>
      `,
      tips: [
        'Start with GPT-3.5 for most use cases',
        'Upgrade to GPT-4 for complex tasks',
        'Monitor token usage and costs',
        'Test performance with your specific prompts',
      ],
    },
    {
      title: 'Configuration',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">⚙️ Bot Settings</h5>
          <ul class="text-body-2">
            <li><strong>Memory:</strong> How much context the bot can remember</li>
            <li><strong>Temperature:</strong> Controls creativity vs consistency</li>
            <li><strong>Max Tokens:</strong> Maximum response length</li>
            <li><strong>Tools:</strong> Additional capabilities and integrations</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">💡 Configuration Tips</h5>
          <ul class="text-body-2">
            <li>Set appropriate memory limits for your use case</li>
            <li>Adjust temperature based on creativity needs</li>
            <li>Enable relevant tools and integrations</li>
            <li>Test configurations with sample conversations</li>
          </ul>
        </div>
      `,
      fullContent: `
        <div class="mb-4">
          <h4 class="text-h6 font-weight-bold mb-3">Complete Configuration Guide</h4>
          <p class="text-body-1 mb-3">
            Fine-tune your bot's behavior and capabilities through careful configuration of various parameters.
          </p>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🧠 Memory Settings</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>Short-term:</strong> Remember recent conversation context</li>
            <li><strong>Long-term:</strong> Store important information for future use</li>
            <li><strong>Context Window:</strong> Maximum tokens for conversation history</li>
            <li><strong>Memory Management:</strong> Automatic cleanup of old information</li>
          </ul>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🎛️ Response Parameters</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>Temperature:</strong> 0.0 = focused, 1.0 = creative</li>
            <li><strong>Max Tokens:</strong> Limit response length</li>
            <li><strong>Top P:</strong> Control response diversity</li>
            <li><strong>Frequency Penalty:</strong> Reduce repetition</li>
          </ul>
        </div>
      `,
      tips: [
        'Start with default settings',
        'Adjust based on testing results',
        'Monitor performance metrics',
        'Balance functionality with cost',
      ],
    },
    {
      title: 'Review & Create',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🔍 Final Review</h5>
          <ul class="text-body-2">
            <li><strong>Bot Identity:</strong> Name and description are clear</li>
            <li><strong>Configuration:</strong> Settings match your requirements</li>
            <li><strong>Prompt:</strong> Instructions are comprehensive</li>
            <li><strong>Tools:</strong> Required integrations are enabled</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🚀 Ready to Create</h5>
          <ul class="text-body-2">
            <li>Double-check all information</li>
            <li>Test your bot after creation</li>
            <li>Monitor performance and feedback</li>
            <li>Be prepared to iterate and improve</li>
          </ul>
        </div>
      `,
      fullContent: `
        <div class="mb-4">
          <h4 class="text-h6 font-weight-bold mb-3">Complete Review & Creation Guide</h4>
          <p class="text-body-1 mb-3">
            Before creating your bot, take a moment to review all settings and ensure everything is configured correctly.
          </p>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🔍 Review Checklist</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>Bot Identity:</strong> Name is clear and descriptive</li>
            <li><strong>Purpose:</strong> Description accurately reflects the bot's function</li>
            <li><strong>Prompt:</strong> Instructions are clear and comprehensive</li>
            <li><strong>Model:</strong> Selected model matches your requirements</li>
            <li><strong>Settings:</strong> Configuration is appropriate for your use case</li>
            <li><strong>Tools:</strong> Required integrations are enabled</li>
          </ul>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🎯 Post-Creation Steps</h5>
          <ul class="text-body-1 mb-3">
            <li><strong>Test Your Bot:</strong> Have a conversation to validate behavior</li>
            <li><strong>Monitor Performance:</strong> Check response quality and speed</li>
            <li><strong>Gather Feedback:</strong> Get input from intended users</li>
            <li><strong>Iterate:</strong> Make adjustments based on testing results</li>
            <li><strong>Deploy:</strong> Make your bot available to users</li>
          </ul>
        </div>
      `,
      tips: [
        'Double-check all information before creating',
        'Test your bot immediately after creation',
        'Be prepared to iterate and improve',
        'Monitor performance and user feedback',
      ],
    },
  ]

  // Template information
  const botTemplates: TemplateInfo[] = [
    {
      name: 'Customer Support Bot',
      description:
        'A helpful customer support assistant that can handle inquiries, provide information, and ensure customer satisfaction.',
      category: 'support',
      tags: ['customer-service', 'support', 'professional'],
      model: 'gpt-4',
      prompt:
        "You are a professional customer support representative. Your role is to help customers with their inquiries, provide accurate information, and ensure customer satisfaction. Always be polite, patient, and helpful. If you don't know something, say so and offer to connect them with a human representative.",
      memory: '4000',
      tools: 'knowledge_base, ticket_system, faq_database',
    },
    {
      name: 'Developer Assistant',
      description:
        'A coding assistant that helps with code reviews, debugging, and best practices.',
      category: 'development',
      tags: ['coding', 'development', 'technical'],
      model: 'gpt-4',
      prompt:
        'You are a coding assistant. Help with code reviews, debugging, and best practices. Provide clear explanations and suggest improvements. Always consider security, performance, and maintainability in your recommendations.',
      memory: '4000',
      tools: 'code_analysis, documentation, testing',
    },
  ]

  // Computed properties
  const currentGuide = computed(() => {
    if (currentBuilder.value === 'bot') {
      return botStepGuides[currentStep.value] || null
    }
    return null
  })

  const currentTemplate = computed(() => {
    if (currentBuilder.value === 'bot') {
      return botTemplates[0] // Default to first template, could be made dynamic
    }
    return null
  })

  const totalSteps = computed(() => {
    if (currentBuilder.value === 'bot') {
      return botStepGuides.length
    }
    return 0
  })

  const isFirstStep = computed(() => currentStep.value === 0)
  const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
  const progressPercentage = computed(() => {
    if (totalSteps.value === 0) return 0
    return ((currentStep.value + 1) / totalSteps.value) * 100
  })

  // Actions
  const setBuilder = (builder: BuilderType) => {
    currentBuilder.value = builder
    currentStep.value = 0
  }

  const setStep = (step: number) => {
    if (step >= 0 && step < totalSteps.value) {
      currentStep.value = step
    }
  }

  const nextStep = () => {
    if (!isLastStep.value) {
      currentStep.value++
    }
  }

  const previousStep = () => {
    if (!isFirstStep.value) {
      currentStep.value--
    }
  }

  const resetSteps = () => {
    currentStep.value = 0
  }

  const getStepGuide = (step: number) => {
    if (
      currentBuilder.value === 'bot' &&
      step >= 0 &&
      step < botStepGuides.length
    ) {
      return botStepGuides[step]
    }
    return null
  }

  const getTemplateByName = (name: string) => {
    return botTemplates.find(template => template.name === name)
  }

  const getTemplatesByCategory = (category: string) => {
    return botTemplates.filter(template => template.category === category)
  }

  const getTemplatesByTag = (tag: string) => {
    return botTemplates.filter(template => template.tags?.includes(tag))
  }

  return {
    // State
    currentBuilder,
    currentStep,

    // Computed
    currentGuide,
    currentTemplate,
    totalSteps,
    isFirstStep,
    isLastStep,
    progressPercentage,

    // Data
    botTemplates,

    // Actions
    setBuilder,
    setStep,
    nextStep,
    previousStep,
    resetSteps,
    getStepGuide,
    getTemplateByName,
    getTemplatesByCategory,
    getTemplatesByTag,
  }
})
