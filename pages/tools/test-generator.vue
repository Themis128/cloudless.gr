<template>
  <div class="test-generator-container">
    <div class="tool-header">
      <h1>Test Generator</h1>
      <p>
        Generate comprehensive unit tests, integration tests, and end-to-end test suites for your
        applications.
      </p>
    </div>

    <div class="tool-content">
      <div class="input-section">
        <h2>Code Input</h2>
        <div class="code-input-container">
          <textarea
            v-model="codeInput"
            placeholder="Paste your code here to generate tests..."
            class="code-textarea"
            rows="15"
          ></textarea>
        </div>

        <div class="options-section">
          <h3>Test Options</h3>
          <div class="options-grid">
            <div class="option-group">
              <label>Test Framework</label>
              <select v-model="testFramework" class="form-select">
                <option value="jest">Jest</option>
                <option value="vitest">Vitest</option>
                <option value="mocha">Mocha</option>
                <option value="cypress">Cypress</option>
                <option value="playwright">Playwright</option>
              </select>
            </div>

            <div class="option-group">
              <label>Test Type</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="testTypes.unit" />
                  Unit Tests
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="testTypes.integration" />
                  Integration Tests
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="testTypes.e2e" />
                  E2E Tests
                </label>
              </div>
            </div>

            <div class="option-group">
              <label>Language</label>
              <select v-model="language" class="form-select">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
              </select>
            </div>
          </div>
        </div>

        <button @click="generateTests" :disabled="isGenerating" class="generate-button">
          {{ isGenerating ? 'Generating...' : 'Generate Tests' }}
        </button>
      </div>

      <div class="output-section">
        <h2>Generated Tests</h2>
        <div v-if="generatedTests" class="test-output">
          <div class="output-header">
            <h3>{{ testFramework }} Tests</h3>
            <button @click="copyToClipboard" class="copy-button">Copy</button>
          </div>
          <pre class="code-output">{{ generatedTests }}</pre>
        </div>
        <div v-else class="placeholder-output">
          <p>Generated tests will appear here...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Page meta
definePageMeta({
  title: 'Test Generator',
});

// Reactive state
const codeInput = ref('');
const testFramework = ref('jest');
const language = ref('javascript');
const testTypes = reactive({
  unit: true,
  integration: false,
  e2e: false,
});
const isGenerating = ref(false);
const generatedTests = ref('');

// Generate tests using LLM
const generateTests = async () => {
  if (!codeInput.value.trim()) {
    alert('Please enter some code to generate tests for.');
    return;
  }

  isGenerating.value = true;

  try {
    const prompt = `Generate ${testFramework.value} tests for the following ${language.value} code.
    Include ${Object.entries(testTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type)
      .join(', ')} tests.

    Code:
    ${codeInput.value}

    Please provide comprehensive test coverage with proper assertions and edge cases.`;

    const response = (await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt },
    })) as any;

    generatedTests.value = response?.response || response || 'No response received';
  } catch (error) {
    console.error('Error generating tests:', error);
    alert('Failed to generate tests. Please try again.');
  } finally {
    isGenerating.value = false;
  }
};

// Copy to clipboard
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(generatedTests.value);
    alert('Tests copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};
</script>

<style scoped>
.test-generator-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.tool-header {
  text-align: center;
  margin-bottom: 3rem;
}

.tool-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.tool-header p {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.tool-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.input-section,
.output-section {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid rgba(219, 234, 254, 0.6);
}

.input-section h2,
.output-section h2 {
  color: #1e40af;
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.code-input-container {
  margin-bottom: 1.5rem;
}

.code-textarea {
  width: 100%;
  padding: 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
  background: #f8fafc;
}

.options-section {
  margin-bottom: 1.5rem;
}

.options-section h3 {
  color: #334155;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.options-grid {
  display: grid;
  gap: 1rem;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-group label {
  font-weight: 500;
  color: #334155;
}

.form-select {
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: white;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  margin: 0;
}

.generate-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.generate-button:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.generate-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.test-output {
  background: #1e293b;
  border-radius: 6px;
  overflow: hidden;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #334155;
  color: white;
}

.output-header h3 {
  margin: 0;
  font-size: 1rem;
}

.copy-button {
  padding: 0.25rem 0.75rem;
  background: #475569;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.copy-button:hover {
  background: #64748b;
}

.code-output {
  padding: 1rem;
  margin: 0;
  color: #e2e8f0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
}

.placeholder-output {
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;
  font-style: italic;
}

@media (max-width: 768px) {
  .tool-content {
    grid-template-columns: 1fr;
  }

  .tool-header h1 {
    font-size: 2rem;
  }
}
</style>
