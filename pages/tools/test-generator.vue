<template>
  <div class="test-generator-container">
    <div class="header">
      <h1>Test Generator</h1>
      <p>Generate comprehensive unit tests, integration tests, and end-to-end test suites for your applications.</p>
    </div>

    <div class="main-content">
      <div class="input-section">
        <div class="form-group">
          <label for="code-input">Code to Test</label>
          <textarea
            id="code-input"
            v-model="codeInput"
            placeholder="Paste your code here to generate tests..."
            rows="10"
            class="code-textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="test-type">Test Type</label>
          <select v-model="testType" class="test-type-select">
            <option value="unit">Unit Tests</option>
            <option value="integration">Integration Tests</option>
            <option value="e2e">End-to-End Tests</option>
            <option value="all">All Test Types</option>
          </select>
        </div>

        <div class="form-group">
          <label for="framework">Testing Framework</label>
          <select v-model="framework" class="framework-select">
            <option value="jest">Jest</option>
            <option value="vitest">Vitest</option>
            <option value="mocha">Mocha</option>
            <option value="cypress">Cypress (E2E)</option>
            <option value="playwright">Playwright (E2E)</option>
          </select>
        </div>

        <button @click="generateTests" :disabled="isGenerating" class="generate-btn">
          {{ isGenerating ? 'Generating...' : 'Generate Tests' }}
        </button>
      </div>

      <div class="output-section">
        <div class="output-header">
          <h3>Generated Tests</h3>
          <button @click="copyToClipboard" class="copy-btn">Copy to Clipboard</button>
        </div>
        <pre v-if="generatedTests" class="test-output">{{ generatedTests }}</pre>
        <div v-else class="placeholder">
          <p>Generated tests will appear here...</p>
        </div>
      </div>
    </div>

    <div class="examples-section">
      <h2>Examples</h2>
      <div class="examples-grid">
        <div class="example-card" @click="loadExample('react-component')">
          <h4>React Component</h4>
          <p>Generate tests for a React functional component</p>
        </div>
        <div class="example-card" @click="loadExample('api-endpoint')">
          <h4>API Endpoint</h4>
          <p>Test an Express.js API endpoint</p>
        </div>
        <div class="example-card" @click="loadExample('utility-function')">
          <h4>Utility Function</h4>
          <p>Test a pure JavaScript utility function</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  title: 'Test Generator'
})

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
}`
}

const loadExample = (exampleKey: string) => {
  codeInput.value = examples[exampleKey as keyof typeof examples]
}

const generateTests = async () => {
  if (!codeInput.value.trim()) {
    alert('Please enter some code to test')
    return
  }

  isGenerating.value = true
  generatedTests.value = ''

  try {
    const prompt = `Generate ${testType.value} tests using ${framework.value} for the following code:

${codeInput.value}

Please provide comprehensive test cases that cover:
- Happy path scenarios
- Edge cases
- Error conditions
- Input validation

Format the response as clean, runnable test code.`

    const response = await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt }
    }) as any

    generatedTests.value = response?.response || response || 'Failed to generate tests'
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
  padding: 2rem 1rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.header p {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #374151;
}

.code-textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 200px;
}

.code-textarea:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.test-type-select,
.framework-select {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  background-color: white;
}

.test-type-select:focus,
.framework-select:focus {
  outline: none;
  border-color: #1e40af;
}

.generate-btn {
  padding: 1rem 2rem;
  background-color: #1e40af;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.generate-btn:hover:not(:disabled) {
  background-color: #1e3a8a;
}

.generate-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.output-section {
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
}

.output-header h3 {
  margin: 0;
  color: #374151;
}

.copy-btn {
  padding: 0.5rem 1rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background-color: #059669;
}

.test-output {
  padding: 1rem;
  background-color: #1f2937;
  color: #f9fafb;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 500px;
  overflow-y: auto;
}

.placeholder {
  padding: 2rem;
  text-align: center;
  color: #9ca3af;
}

.examples-section {
  margin-top: 3rem;
}

.examples-section h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #374151;
}

.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.example-card {
  padding: 1.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.example-card:hover {
  border-color: #1e40af;
  background-color: #f8fafc;
}

.example-card h4 {
  margin: 0 0 0.5rem 0;
  color: #1e40af;
}

.example-card p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .header h1 {
    font-size: 2rem;
  }
  
  .examples-grid {
    grid-template-columns: 1fr;
  }
}
</style>
