<template>
  <div class="codegen-page">
    <div class="codegen-hero">
      <h1 class="codegen-heading">Code Generation</h1>
      <p class="codegen-subheading">Create efficient, clean code with AI assistance</p>
    </div>

    <div class="codegen-container">
      <div class="codegen-layout">
        <!-- Text Editor Component -->
        <div class="editor-container">
          <div class="editor-header">
            <h3 class="editor-title">Code Editor</h3>
            <div class="editor-actions">
              <button @click="handleClearEditor" class="action-button clear-button" type="button">
                Clear
              </button>
              <button
                @click="handleRunCode"
                class="action-button run-button"
                type="button"
                :disabled="!editorContent.trim()"
              >
                Run
              </button>
            </div>
          </div>
          <textarea
            v-model="editorContent"
            class="code-editor"
            placeholder="Type or paste your code here..."
            spellcheck="false"
          ></textarea>
          <div class="editor-footer">
            <span class="editor-info">{{ editorContent.length }} characters</span>
            <div class="language-selector">
              <label for="language">Language:</label>
              <select id="language" v-model="selectedLanguage">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="vue">Vue</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Answers Container Component -->
        <div class="answers-container">
          <div class="answers-header">
            <h3 class="answers-title">AI Responses</h3>
            <button
              @click="handleClearHistory"
              class="action-button clear-history-button"
              type="button"
            >
              Clear History
            </button>
          </div>

          <div class="conversation-history" ref="historyContainer">
            <div v-if="conversationHistory.length === 0" class="empty-history">
              <p>Your conversation with AI will appear here.</p>
            </div>

            <div
              v-for="(item, index) in conversationHistory"
              :key="index"
              class="conversation-item"
            >
              <div class="user-message">
                <div class="message-header">
                  <span class="user-icon">👤</span>
                  <span class="user-label">You</span>
                </div>
                <div class="message-content">{{ item.prompt }}</div>
              </div>

              <div class="ai-message">
                <div class="message-header">
                  <span class="ai-icon">🤖</span>
                  <span class="ai-label">AI</span>
                </div>
                <div class="message-content">
                  <pre><code>{{ item.response }}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="prompt-input-container">
            <input
              v-model="prompt"
              @keyup.enter="handleSendPrompt"
              :disabled="loading"
              placeholder="Ask a question or request code..."
              class="prompt-input"
            />
            <button
              @click="handleSendPrompt"
              :disabled="loading || !prompt.trim()"
              class="send-button"
              type="button"
            >
              {{ loading ? 'Processing...' : 'Send' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

// Define types
interface ConversationItem {
  prompt: string;
  response: string;
}

// Editor state
const editorContent = ref<string>('');
const selectedLanguage = ref<string>('javascript');

// Conversation state
const prompt = ref<string>('');
const loading = ref<boolean>(false);
const conversationHistory = ref<ConversationItem[]>([]);
const historyContainer = ref<HTMLElement | null>(null);

// Error handling
const error = ref<string>('');

// Methods
const handleClearEditor = (): void => {
  editorContent.value = '';
};

const handleClearHistory = (): void => {
  conversationHistory.value = [];
};

const handleSendPrompt = async (): Promise<void> => {
  if (!prompt.value.trim() || loading.value) return;

  try {
    loading.value = true;
    error.value = '';

    // In a real application, this would call your API
    // For this example, we'll simulate an API response
    const userPrompt = prompt.value;

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock response - in real app this would come from your API
    const mockResponse = `Here's a response to: "${userPrompt}"
    
// Example code based on your query
function processUserRequest(input) {
  console.log("Processing:", input);
  return {
    status: "success",
    data: input.toUpperCase()
  };
}`;

    // Add to conversation history
    conversationHistory.value.push({
      prompt: userPrompt,
      response: mockResponse,
    });

    // Clear input
    prompt.value = '';

    // Scroll to the bottom of the conversation history
    scrollToBottom();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unknown error occurred';
  } finally {
    loading.value = false;
  }
};

const handleRunCode = (): void => {
  if (!editorContent.value.trim()) return;

  // Use the editor content as the prompt
  prompt.value = `Please analyze/improve/run this ${selectedLanguage.value} code:\n\n${editorContent.value}`;
  handleSendPrompt();
};

const scrollToBottom = (): void => {
  setTimeout(() => {
    if (historyContainer.value) {
      historyContainer.value.scrollTop = historyContainer.value.scrollHeight;
    }
  }, 100);
};

// Scroll to bottom when conversation history changes
watch(conversationHistory, () => {
  scrollToBottom();
});

onMounted(() => {
  // Auto-focus the editor when the component mounts
  const editorEl = document.querySelector('.code-editor') as HTMLTextAreaElement;
  if (editorEl) {
    editorEl.focus();
  }
});
</script>

<script lang="ts">
export default {
  layout: 'default',
};
</script>

<style scoped>
.codegen-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  min-height: 85vh;
}

.codegen-hero {
  text-align: center;
  margin-bottom: 2rem;
  animation: fadeIn 0.8s ease-out;
}

.codegen-heading {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.codegen-subheading {
  font-size: 1.2rem;
  color: #64748b;
  max-width: 800px;
}

.codegen-container {
  background: rgba(255, 255, 255, 0.97);
  border-radius: 1.5rem;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.05),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  padding: 2rem;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  backdrop-filter: blur(10px);
}

.codegen-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 2rem;
  width: 100%;
}

/* Editor styles */
.editor-container {
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.editor-title {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  margin: 0;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
}

.clear-button {
  background-color: #f1f5f9;
  color: #64748b;
}

.clear-button:hover {
  background-color: #e2e8f0;
}

.run-button {
  background-color: #2563eb;
  color: white;
}

.run-button:hover {
  background-color: #1d4ed8;
}

.run-button:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.code-editor {
  flex: 1;
  width: 100%;
  min-height: 350px;
  padding: 1rem;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #1e293b;
  background: #ffffff;
  border: none;
  resize: none;
  outline: none;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 0.875rem;
}

.editor-info {
  color: #64748b;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.language-selector label {
  color: #64748b;
}

.language-selector select {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #cbd5e1;
  color: #1e293b;
  font-size: 0.875rem;
}

/* Answers container styles */
.answers-container {
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.answers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.answers-title {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  margin: 0;
}

.clear-history-button {
  background-color: #f1f5f9;
  color: #64748b;
}

.clear-history-button:hover {
  background-color: #e2e8f0;
}

.conversation-history {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #ffffff;
  max-height: 350px;
}

.empty-history {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  text-align: center;
  font-style: italic;
}

.conversation-item {
  margin-bottom: 1.5rem;
}

.conversation-item:last-child {
  margin-bottom: 0;
}

.user-message,
.ai-message {
  margin-bottom: 1rem;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.user-icon,
.ai-icon {
  font-size: 1.25rem;
}

.user-label,
.ai-label {
  font-weight: 600;
  font-size: 0.875rem;
}

.user-label {
  color: #4b5563;
}

.ai-label {
  color: #2563eb;
}

.message-content {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.user-message .message-content {
  background: #f1f5f9;
  color: #334155;
}

.ai-message .message-content {
  background: #eff6ff;
  color: #1e40af;
}

.ai-message pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.prompt-input-container {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.prompt-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #cbd5e1;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.2s;
}

.prompt-input:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.send-button {
  padding: 0.75rem 1.25rem;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.send-button:hover {
  background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%);
}

.send-button:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

/* Responsive styles */
@media (max-width: 900px) {
  .codegen-layout {
    grid-template-columns: 1fr;
    grid-gap: 1.5rem;
  }

  .codegen-container {
    padding: 1.5rem;
  }

  .codegen-heading {
    font-size: 2rem;
  }

  .code-editor,
  .conversation-history {
    min-height: 250px;
    max-height: 300px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
