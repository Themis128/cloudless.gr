<template>
  <div class="llm-demo">
    <h2>LLM Integration Demo</h2>

    <div class="prompt-section">
      <textarea
        v-model="prompt"
        placeholder="Enter your prompt here..."
        rows="4"
        class="prompt-input"
      ></textarea>

      <button
        @click="handleSubmit"
        :disabled="loading"
        class="submit-button"
      >
        {{ loading ? 'Generating...' : 'Generate Response' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="response" class="response-section">
      <h3>Response:</h3>
      <pre class="response-content">{{ response }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLLMAndFileViewer } from '@/composables/useLLMAndFileViewer';
import { ref } from 'vue';

const prompt = ref('');
const { response, loading, error, sendPrompt } = useLLMAndFileViewer();

const handleSubmit = async () => {
  if (!prompt.value.trim() || loading.value) return;

  await sendPrompt(prompt.value, (chunk) => {
    // Handle streaming chunks if needed
    console.log('Received chunk:', chunk);
  });
};
</script>

<style scoped>
.llm-demo {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

h2 {
  color: #1e40af;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  font-weight: 700;
}

.prompt-section {
  margin-bottom: 1.5rem;
}

.prompt-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 1rem;
  margin-bottom: 1rem;
  background: white;
  resize: vertical;
}

.submit-button {
  background: #2563eb;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.submit-button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.error-message {
  color: #dc2626;
  padding: 0.75rem;
  background: #fee2e2;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.response-section {
  margin-top: 2rem;
}

h3 {
  color: #1e40af;
  font-size: 1.2rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.response-content {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
