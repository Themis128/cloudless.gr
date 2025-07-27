<template>
  <v-container class="test-generator-container">
    <div class="text-center mb-8">
      <h1 class="text-h3 font-weight-bold mb-4">Test Generator</h1>
      <p class="text-body-1 text-medium-emphasis">
        Generate comprehensive unit tests, integration tests, and end-to-end
        test suites for your applications.
      </p>
    </div>

    <v-row>
      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4">Input</v-card-title>

          <v-form @submit.prevent="generateTests">
            <v-textarea
              v-model="codeInput"
              label="Code to Test"
              placeholder="Paste your code here to generate tests..."
              rows="10"
              variant="outlined"
              class="mb-4"
              auto-grow
            ></v-textarea>

            <v-select
              v-model="testType"
              label="Test Type"
              :items="[
                { title: 'Unit Tests', value: 'unit' },
                { title: 'Integration Tests', value: 'integration' },
                { title: 'End-to-End Tests', value: 'e2e' },
                { title: 'All Test Types', value: 'all' },
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-select
              v-model="framework"
              label="Testing Framework"
              :items="[
                { title: 'Jest', value: 'jest' },
                { title: 'Vitest', value: 'vitest' },
                { title: 'Mocha', value: 'mocha' },
                { title: 'Cypress (E2E)', value: 'cypress' },
                { title: 'Playwright (E2E)', value: 'playwright' },
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
              @click="generateTests"
            >
              {{ isGenerating ? 'Generating...' : 'Generate Tests' }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-h5">Generated Tests</span>
            <v-btn
              color="success"
              variant="outlined"
              size="small"
              @click="copyToClipboard"
              :disabled="!generatedTests"
            >
              Copy to Clipboard
            </v-btn>
          </v-card-title>

          <v-card-text>
            <v-textarea
              v-if="generatedTests"
              :model-value="generatedTests"
              readonly
              variant="outlined"
              rows="20"
              class="font-family-monospace"
              bg-color="grey-lighten-4"
            ></v-textarea>
            <div v-else class="text-center text-medium-emphasis pa-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4"
                >mdi-code-braces</v-icon
              >
              <p>Generated tests will appear here...</p>
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
            <v-card
              class="example-card"
              @click="loadExample('react-component')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4"
                  >mdi-react</v-icon
                >
                <h4 class="text-h6 mb-2">React Component</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Generate tests for a React functional component
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('api-endpoint')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-api</v-icon>
                <h4 class="text-h6 mb-2">API Endpoint</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Test an Express.js API endpoint
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('utility-function')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4"
                  >mdi-function</v-icon
                >
                <h4 class="text-h6 mb-2">Utility Function</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Test a pure JavaScript utility function
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
import { ref, onMounted } from 'vue'
import { useToolsStore } from '~/stores/toolsStore'

definePageMeta({
  title: 'Test Generator',
})

// Use tools store
const toolsStore = useToolsStore()

const codeInput = ref('')
const testType = ref('unit')
const framework = ref('jest')
const isGenerating = ref(false)
const generatedTests = ref('')

const examples = {
  'react-component': `import React from 'react';

const Button = ({ onClick, children, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn"
    >
      {children}
    </button>
  );
};

export default Button;`,
  'api-endpoint': `app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});`,
  'utility-function': `function formatCurrency(amount, currency = 'USD') {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a positive number');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}`,
}

const loadExample = (exampleKey: string) => {
  codeInput.value = examples[exampleKey as keyof typeof examples]
}

// Record tool usage on mount
onMounted(() => {
  toolsStore.recordToolUsage('test-generator')
})

const generateTests = async () => {
  if (!codeInput.value.trim()) {
    alert('Please enter some code to test')
    return
  }

  isGenerating.value = true
  generatedTests.value = ''

  const startTime = Date.now()

  try {
    const prompt = `Generate ${testType.value} tests using ${framework.value} for the following code:

${codeInput.value}

Please provide comprehensive test cases that cover:
- Happy path scenarios
- Edge cases
- Error conditions
- Input validation

Format the response as clean, runnable test code.`

    const response = (await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt },
    })) as any

    generatedTests.value =
      response?.response || response || 'Failed to generate tests'
    
    // Record tool usage
    const duration = Date.now() - startTime
    toolsStore.recordToolUsage('test-generator', true, duration)
  } catch (error) {
    console.error('Error generating tests:', error)
    generatedTests.value = 'Error generating tests. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

const copyToClipboard = async () => {
  if (!generatedTests.value) return

  try {
    await navigator.clipboard.writeText(generatedTests.value)
    alert('Tests copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
    alert('Failed to copy to clipboard')
  }
}
</script>

<style scoped>
.test-generator-container {
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
