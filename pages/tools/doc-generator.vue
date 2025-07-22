<template>
  <div class="doc-generator-container">
    <div class="header">
      <h1>Documentation Generator</h1>
      <p>Generate comprehensive documentation from your code comments, API definitions, and project structure automatically.</p>
    </div>

    <div class="main-content">
      <div class="input-section">
        <div class="form-group">
          <label for="code-input">Code to Document</label>
          <textarea
            id="code-input"
            v-model="codeInput"
            placeholder="Paste your code here to generate documentation..."
            rows="10"
            class="code-textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="doc-type">Documentation Type</label>
          <select v-model="docType" class="doc-type-select">
            <option value="api">API Documentation</option>
            <option value="readme">README</option>
            <option value="comments">Code Comments</option>
            <option value="interactive">Interactive Docs</option>
          </select>
        </div>

        <div class="form-group">
          <label for="format">Output Format</label>
          <select v-model="format" class="format-select">
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="jsdoc">JSDoc</option>
            <option value="swagger">OpenAPI/Swagger</option>
          </select>
        </div>

        <button @click="generateDocs" :disabled="isGenerating" class="generate-btn">
          {{ isGenerating ? 'Generating...' : 'Generate Documentation' }}
        </button>
      </div>

      <div class="output-section">
        <div class="output-header">
          <h3>Generated Documentation</h3>
          <button @click="copyToClipboard" class="copy-btn">Copy to Clipboard</button>
        </div>
        <pre v-if="generatedDocs" class="doc-output">{{ generatedDocs }}</pre>
        <div v-else class="placeholder">
          <p>Generated documentation will appear here...</p>
        </div>
      </div>
    </div>

    <div class="examples-section">
      <h2>Examples</h2>
      <div class="examples-grid">
        <div class="example-card" @click="loadExample('api-function')">
          <h4>API Function</h4>
          <p>Generate API documentation for a function</p>
        </div>
        <div class="example-card" @click="loadExample('react-component')">
          <h4>React Component</h4>
          <p>Document a React component with props</p>
        </div>
        <div class="example-card" @click="loadExample('class')">
          <h4>Class Definition</h4>
          <p>Generate documentation for a class</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  title: 'Documentation Generator'
})

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
  'class': `/**
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
}`
}

const loadExample = (exampleKey: string) => {
  codeInput.value = examples[exampleKey as keyof typeof examples]
}

const generateDocs = async () => {
  if (!codeInput.value.trim()) {
    alert('Please enter some code to document')
    return
  }

  isGenerating.value = true
  generatedDocs.value = ''

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

    const response = await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt }
    }) as any

    generatedDocs.value = response?.response || response || 'Failed to generate documentation'
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

.doc-type-select,
.format-select {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  background-color: white;
}

.doc-type-select:focus,
.format-select:focus {
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

.doc-output {
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
