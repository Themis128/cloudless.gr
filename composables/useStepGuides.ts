import { ref, computed } from 'vue'

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

export const useStepGuides = () => {
  const currentBuilder = ref<'bot' | 'model' | 'pipeline' | 'llm'>('bot')
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
        'Consider the user experience'
      ]
    },
    {
      title: 'Model Selection',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🧠 AI Model Options</h5>
          <ul class="text-body-2">
            <li><strong>GPT-4:</strong> Most capable, best for complex reasoning and creative tasks</li>
            <li><strong>GPT-3.5:</strong> Good balance of performance and cost for most use cases</li>
            <li><strong>Claude:</strong> Excellent for analysis and detailed explanations</li>
            <li><strong>Custom Models:</strong> Specialized models for specific domains</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">⚖️ Selection Criteria</h5>
          <ul class="text-body-2">
            <li>Consider your bot's complexity requirements</li>
            <li>Balance performance needs with cost constraints</li>
            <li>Match model capabilities to your use case</li>
            <li>Test different models for your specific scenario</li>
          </ul>
        </div>
      `,
      fullContent: `
        <div class="mb-4">
          <h4 class="text-h6 font-weight-bold mb-3">Complete Model Selection Guide</h4>
          <p class="text-body-1 mb-3">
            Choosing the right AI model is crucial for your bot's performance. Consider factors like complexity, cost, and specific requirements.
          </p>
        </div>
        
        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🧠 Model Comparison</h5>
          <div class="text-body-1">
            <div class="mb-3">
              <p class="font-weight-bold mb-1">GPT-4</p>
              <ul class="text-body-2">
                <li><strong>Best for:</strong> Complex reasoning, creative tasks, detailed analysis</li>
                <li><strong>Cost:</strong> Higher</li>
                <li><strong>Speed:</strong> Slower</li>
                <li><strong>Use when:</strong> You need the highest quality responses</li>
              </ul>
            </div>
            
            <div class="mb-3">
              <p class="font-weight-bold mb-1">GPT-3.5</p>
              <ul class="text-body-2">
                <li><strong>Best for:</strong> General conversation, simple tasks, cost-effective solutions</li>
                <li><strong>Cost:</strong> Lower</li>
                <li><strong>Speed:</strong> Faster</li>
                <li><strong>Use when:</strong> Good performance at lower cost is needed</li>
              </ul>
            </div>
            
            <div class="mb-3">
              <p class="font-weight-bold mb-1">Claude</p>
              <ul class="text-body-2">
                <li><strong>Best for:</strong> Analysis, explanations, safety-focused applications</li>
                <li><strong>Cost:</strong> Medium</li>
                <li><strong>Speed:</strong> Medium</li>
                <li><strong>Use when:</strong> You need detailed analysis or safety is important</li>
              </ul>
            </div>
          </div>
        </div>
      `,
      tips: [
        'Start with GPT-3.5 for most use cases',
        'Upgrade to GPT-4 for complex reasoning',
        'Consider cost vs. performance trade-offs',
        'Test multiple models before finalizing'
      ]
    },
    {
      title: 'Settings Configuration',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">⚙️ Configuration Options</h5>
          <ul class="text-body-2">
            <li><strong>Memory:</strong> How much conversation history to remember</li>
            <li><strong>Temperature:</strong> Controls response creativity (0.0 = focused, 1.0 = creative)</li>
            <li><strong>Max Tokens:</strong> Maximum response length</li>
            <li><strong>Tools:</strong> Additional capabilities and integrations</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🎛️ Recommended Settings</h5>
          <ul class="text-body-2">
            <li>Memory: 4000 tokens for most conversations</li>
            <li>Temperature: 0.7 for balanced responses</li>
            <li>Max Tokens: 1000 for concise responses</li>
            <li>Enable relevant tools for your use case</li>
          </ul>
        </div>
      `,
      fullContent: `
        <div class="mb-4">
          <h4 class="text-h6 font-weight-bold mb-3">Complete Settings Configuration Guide</h4>
          <p class="text-body-1 mb-3">
            Fine-tune your bot's behavior with these configuration options. Each setting affects how your bot responds and performs.
          </p>
        </div>
        
        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🧠 Memory Configuration</h5>
          <p class="text-body-1 mb-2">Memory determines how much conversation history your bot remembers:</p>
          <ul class="text-body-1 mb-3">
            <li><strong>1000 tokens:</strong> Short-term memory, good for simple Q&A</li>
            <li><strong>4000 tokens:</strong> Standard memory, suitable for most conversations</li>
            <li><strong>8000 tokens:</strong> Extended memory, for complex multi-turn conversations</li>
            <li><strong>16000 tokens:</strong> Long memory, for detailed analysis sessions</li>
          </ul>
        </div>

        <div class="mb-4">
          <h5 class="text-subtitle-1 font-weight-bold mb-2">🌡️ Temperature Settings</h5>
          <p class="text-body-1 mb-2">Temperature controls the randomness and creativity of responses:</p>
          <ul class="text-body-1 mb-3">
            <li><strong>0.0:</strong> Most deterministic, consistent responses</li>
            <li><strong>0.3:</strong> Focused and reliable, good for factual responses</li>
            <li><strong>0.7:</strong> Balanced creativity and consistency (recommended)</li>
            <li><strong>1.0:</strong> Most creative, varied responses</li>
          </ul>
        </div>
      `,
      tips: [
        'Start with default settings and adjust based on testing',
        'Higher memory = better context but higher cost',
        'Lower temperature for factual responses',
        'Test different configurations with your use case'
      ]
    },
    {
      title: 'Review & Create',
      content: `
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">✅ Final Review</h5>
          <ul class="text-body-2">
            <li>Verify all information is correct and complete</li>
            <li>Check that the bot name and description are clear</li>
            <li>Review the prompt for clarity and completeness</li>
            <li>Confirm model selection and settings are appropriate</li>
          </ul>
        </div>
        <div class="mb-3">
          <h5 class="text-subtitle-2 font-weight-bold mb-2">🚀 Ready to Create</h5>
          <ul class="text-body-2">
            <li>Your bot will be created with the specified configuration</li>
            <li>You can test and modify the bot after creation</li>
            <li>Consider creating a test conversation to validate setup</li>
            <li>Monitor performance and adjust settings as needed</li>
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
        'Monitor performance and user feedback'
      ]
    }
  ]

  // Template information
  const botTemplates: TemplateInfo[] = [
    {
      name: 'Customer Support Bot',
      description: 'A helpful customer support assistant that can handle inquiries, provide information, and ensure customer satisfaction.',
      category: 'support',
      tags: ['customer-service', 'support', 'professional'],
      model: 'gpt-4',
      prompt: 'You are a professional customer support representative. Your role is to help customers with their inquiries, provide accurate information, and ensure customer satisfaction. Always be polite, patient, and helpful. If you don\'t know something, say so and offer to connect them with a human representative.',
      memory: '4000',
      tools: 'knowledge_base, ticket_system, faq_database'
    },
    {
      name: 'Developer Assistant',
      description: 'A coding assistant that helps with code reviews, debugging, and best practices.',
      category: 'development',
      tags: ['coding', 'development', 'technical'],
      model: 'gpt-4',
      prompt: 'You are a coding assistant. Help with code reviews, debugging, and best practices. Provide clear explanations and suggest improvements. Always consider security, performance, and maintainability in your recommendations.',
      memory: '4000',
      tools: 'code_analysis, documentation, testing'
    }
  ]

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

  const setBuilder = (builder: 'bot' | 'model' | 'pipeline' | 'llm') => {
    currentBuilder.value = builder
    currentStep.value = 0
  }

  const setStep = (step: number) => {
    currentStep.value = step
  }

  return {
    currentBuilder,
    currentStep,
    currentGuide,
    currentTemplate,
    botTemplates,
    setBuilder,
    setStep
  }
} 