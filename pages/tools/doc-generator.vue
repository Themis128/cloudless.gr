<template>
  <div class="doc-generator-container">
    <div class="tool-header">
      <h1>Documentation Generator</h1>
      <p>
        Generate comprehensive documentation from your code comments, API definitions, and project
        structure automatically.
      </p>
    </div>

    <div class="tool-content">
      <div class="input-section">
        <h2>Code Input</h2>
        <div class="code-input-container">
          <textarea
            v-model="codeInput"
            placeholder="Paste your code here to generate documentation..."
            class="code-textarea"
            rows="15"
          ></textarea>
        </div>

        <div class="options-section">
          <h3>Documentation Options</h3>
          <div class="options-grid">
            <div class="option-group">
              <label>Documentation Type</label>
              <select v-model="docType" class="form-select">
                <option value="api">API Documentation</option>
                <option value="readme">README</option>
                <option value="comments">Code Comments</option>
                <option value="guides">User Guides</option>
                <option value="technical">Technical Docs</option>
              </select>
            </div>

            <div class="option-group">
              <label>Output Format</label>
              <select v-model="outputFormat" class="form-select">
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
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

            <div class="option-group">
              <label>Include Examples</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="includeExamples" />
                  Add usage examples
                </label>
              </div>
            </div>
          </div>
        </div>

        <button @click="generateDocs" :disabled="isGenerating" class="generate-button">
          {{ isGenerating ? 'Generating...' : 'Generate Documentation' }}
        </button>
      </div>

      <div class="output-section">
        <h2>Generated Documentation</h2>
        <div v-if="generatedDocs" class="doc-output">
          <div class="output-header">
            <h3>{{ docType }} Documentation ({{ outputFormat }})</h3>
            <div class="output-actions">
              <button @click="copyToClipboard" class="copy-button">Copy</button>
              <button @click="downloadDoc" class="download-button">Download</button>
            </div>
          </div>
          <div class="doc-content">
            <pre
              v-if="outputFormat === 'markdown' || outputFormat === 'json'"
              class="code-output"
              >{{ generatedDocs }}</pre
            >
            <div v-else v-html="generatedDocs" class="html-output"></div>
          </div>
        </div>
        <div v-else class="placeholder-output">
          <p>Generated documentation will appear here...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Page meta
definePageMeta({
  title: 'Documentation Generator',
});

// Reactive state
const codeInput = ref('');
const docType = ref('api');
const outputFormat = ref('markdown');
const language = ref('javascript');
const includeExamples = ref(true);
const isGenerating = ref(false);
const generatedDocs = ref('');

// Generate documentation using LLM
const generateDocs = async () => {
  if (!codeInput.value.trim()) {
    alert('Please enter some code to generate documentation for.');
    return;
  }

  isGenerating.value = true;

  try {
    const prompt = `Generate ${docType.value} documentation in ${outputFormat.value} format for the following ${language.value} code.
    ${includeExamples.value ? 'Include usage examples and code snippets.' : ''}

    Code:
    ${codeInput.value}

    Please provide comprehensive documentation with proper formatting, examples, and clear explanations.`;

    const response = (await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt },
    })) as any;

    generatedDocs.value = response?.response || response || 'No response received';
  } catch (error) {
    console.error('Error generating documentation:', error);
    alert('Failed to generate documentation. Please try again.');
  } finally {
    isGenerating.value = false;
  }
};

// Copy to clipboard
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(generatedDocs.value);
    alert('Documentation copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

// Download documentation
const downloadDoc = () => {
  const blob = new Blob([generatedDocs.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `documentation.${outputFormat.value === 'markdown' ? 'md' : outputFormat.value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.doc-generator-container {
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

.doc-output {
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

.output-actions {
  display: flex;
  gap: 0.5rem;
}

.copy-button,
.download-button {
  padding: 0.25rem 0.75rem;
  background: #475569;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.copy-button:hover,
.download-button:hover {
  background: #64748b;
}

.doc-content {
  max-height: 600px;
  overflow-y: auto;
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

.html-output {
  padding: 1rem;
  color: #e2e8f0;
  font-size: 0.9rem;
  line-height: 1.6;
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
