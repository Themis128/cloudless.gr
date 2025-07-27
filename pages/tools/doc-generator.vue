<template>
  <v-container class="doc-generator-container">
    <div class="text-center mb-8">
      <h1 class="text-h3 font-weight-bold mb-4">Documentation Generator</h1>
      <p class="text-body-1 text-medium-emphasis">
        Generate comprehensive documentation for your code, APIs, and projects.
      </p>
    </div>

    <v-row>
      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4">Input</v-card-title>

          <v-form @submit.prevent="generateDocs">
            <v-textarea
              v-model="codeInput"
              label="Code to Document"
              placeholder="Paste your code here to generate documentation..."
              rows="10"
              variant="outlined"
              class="mb-4"
              auto-grow
            ></v-textarea>

            <v-select
              v-model="docType"
              label="Documentation Type"
              :items="[
                { title: 'API Documentation', value: 'api' },
                { title: 'Code Comments', value: 'comments' },
                { title: 'README File', value: 'readme' },
                { title: 'Technical Spec', value: 'spec' },
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-select
              v-model="format"
              label="Output Format"
              :items="[
                { title: 'Markdown', value: 'markdown' },
                { title: 'HTML', value: 'html' },
                { title: 'JSDoc', value: 'jsdoc' },
                { title: 'OpenAPI/Swagger', value: 'openapi' },
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-btn
              color="primary"
              size="large"
              block
              :loading="isGenerating"
              :disabled="!codeInput.trim()"
              @click="generateDocs"
            >
              {{ isGenerating ? 'Generating...' : 'Generate Documentation' }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-h5">Generated Documentation</span>
            <v-btn
              color="success"
              variant="outlined"
              size="small"
              @click="copyToClipboard"
              :disabled="!generatedDocs"
            >
              Copy to Clipboard
            </v-btn>
          </v-card-title>

          <v-card-text>
            <v-textarea
              v-if="generatedDocs"
              :model-value="generatedDocs"
              readonly
              variant="outlined"
              rows="20"
              class="font-family-monospace"
              bg-color="grey-lighten-4"
            ></v-textarea>
            <div v-else class="text-center text-medium-emphasis pa-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-file-document</v-icon>
              <p>Generated documentation will appear here...</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-8">
      <v-col cols="12">
        <h2 class="text-h4 text-center mb-6">Examples</h2>
        <v-row>
          <v-col cols="12" md="4">
            <v-card class="example-card" @click="loadExample('api-endpoint')" hover>
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-api</v-icon>
                <h4 class="text-h6 mb-2">API Endpoint</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Generate API documentation for REST endpoints
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card class="example-card" @click="loadExample('react-component')" hover>
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-react</v-icon>
                <h4 class="text-h6 mb-2">React Component</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Document React components with props and examples
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card class="example-card" @click="loadExample('utility-function')" hover>
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-function</v-icon>
                <h4 class="text-h6 mb-2">Utility Function</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Document utility functions with JSDoc comments
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useToolsStore } from '~/stores/toolsStore'

  definePageMeta({
    title: 'Documentation Generator',
  })

  // Use tools store
  const toolsStore = useToolsStore()

  const codeInput = ref('')
  const docType = ref('api')
  const format = ref('markdown')
  const isGenerating = ref(false)
  const generatedDocs = ref('')

  const examples = {
    'api-function': `/**
 * Calculates the total price including tax and discount
 * @param {number} basePrice - The base price of the item
 * @param {number} taxRate - The tax rate as a decimal (e.g., 0.08 for 8%)
 * @param {number} discount - The discount amount
 * @returns {number} The final price
 */
function calculateTotalPrice(basePrice, taxRate = 0.08, discount = 0) {
  if (basePrice < 0) {
    throw new Error('Base price cannot be negative');
  }

  const priceAfterDiscount = basePrice - discount;
  const taxAmount = priceAfterDiscount * taxRate;

  return Math.round((priceAfterDiscount + taxAmount) * 100) / 100;
}`,
    'react-component': `import React from 'react';

interface ButtonProps {
  /** The text to display on the button */
  children: React.ReactNode;
  /** Function called when button is clicked */
  onClick?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** The visual variant of the button */
  variant?: 'primary' | 'secondary' | 'danger';
  /** The size of the button */
  size?: 'small' | 'medium' | 'large';
}

/**
 * A reusable button component with multiple variants
 */
const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'medium'
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`btn btn-\${variant} btn-\${size}\`}
    >
      {children}
    </button>
  );
};

export default Button;`,
    class: `/**
 * Represents a user in the system
 */
class User {
  /**
   * Creates a new user instance
   * @param {string} id - Unique identifier for the user
   * @param {string} name - Full name of the user
   * @param {string} email - Email address of the user
   * @param {string} role - User role (admin, user, moderator)
   */
  constructor(id, name, email, role = 'user') {
    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
    this.createdAt = new Date();
  }

  /**
   * Updates the user's profile information
   * @param {Object} updates - Object containing fields to update
   * @returns {boolean} True if update was successful
   */
  updateProfile(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    Object.assign(this, updates);
    return true;
  }

  /**
   * Checks if the user has admin privileges
   * @returns {boolean} True if user is an admin
   */
  isAdmin() {
    return this.role === 'admin';
  }
}`,
  }

  const loadExample = (exampleKey: string) => {
  codeInput.value = examples[exampleKey as keyof typeof examples]
}

// Record tool usage on mount
onMounted(() => {
  toolsStore.recordToolUsage('doc-generator')
})

  const generateDocs = async () => {
    if (!codeInput.value.trim()) {
      alert('Please enter some code to document')
      return
    }

    isGenerating.value = true
    generatedDocs.value = ''

    const startTime = Date.now()

    try {
      const prompt = `Generate ${docType.value} documentation in ${format.value} format for the following code:

${codeInput.value}

Please provide comprehensive documentation that includes:
- Function/class descriptions
- Parameter explanations
- Return value descriptions
- Usage examples
- Any important notes or warnings

Format the response as clean, well-structured documentation.`

      const response = (await $fetch('/api/generate', {
        method: 'POST',
        body: { prompt },
      })) as any

      generatedDocs.value = response?.response || response || 'Failed to generate documentation'

      // Record tool usage
      const duration = Date.now() - startTime
      toolsStore.recordToolUsage('doc-generator', true, duration)
    } catch (error) {
      console.error('Error generating documentation:', error)
      generatedDocs.value = 'Error generating documentation. Please try again.'
    } finally {
      isGenerating.value = false
    }
  }

  const copyToClipboard = async () => {
    if (!generatedDocs.value) return

    try {
      await navigator.clipboard.writeText(generatedDocs.value)
      alert('Documentation copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('Failed to copy to clipboard')
    }
  }
</script>

<style scoped>
  .doc-generator-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .example-card {
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .example-card:hover {
    transform: translateY(-2px);
  }

  .font-family-monospace {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }
</style>
