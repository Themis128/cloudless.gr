<template>
  <div>
    <div class="llm-3d-bg-fixed"><!-- Optionally add SVG/canvas here --></div>
    <div class="llm-3d-standalone-bg">
      <div class="llm-3d-container-row responsive-chat-layout">
        <div class="llm-user-col chat-col">
          <form class="llm-form" @submit.prevent="sendPrompt">
            <input v-model="prompt" class="llm-input llm-input-large" type="text" placeholder="Ask the LLM anything..."
              :disabled="loadingLLM" required autocomplete="off" autofocus aria-label="Prompt input" />
            <button class="llm-send-btn" type="submit" :disabled="loadingLLM || !prompt">
              <span v-if="loadingLLM" class="spinner"></span>
              {{ loadingLLM ? 'Sending...' : 'Send' }}
            </button>
          </form>
          <form class="llm-form" style="margin-top:1rem;" @submit.prevent="loadComponentByTitle">
            <select v-model="loadTitle" class="llm-input" :disabled="loadingFiles || files.length === 0"
              aria-label="Select file to load">
              <option value="" disabled>Select file to load...</option>
              <option v-for="file in files" :key="file" :value="file">{{ file }}</option>
            </select>
            <button class="llm-send-btn" type="submit" :disabled="loadingFiles || !loadTitle">Load</button>
          </form>
          <div v-if="error" class="llm-error">{{ error }}</div>
          <div v-if="loadingLLM" class="llm-loading">Generating response...</div>
          <div v-if="questionHistory.length" class="llm-history">
            <div v-for="(item, idx) in questionHistory.slice().reverse()" :key="idx" class="llm-history-item">
              <div class="llm-history-q">{{ item.question }}</div>
              <div class="llm-history-a">{{ item.answer }}</div>
            </div>
          </div>
        </div>
        <div class="llm-llm-col editor-col">
          <div v-if="questionHistory.length" class="llm-chat-thread">
            <div v-for="(item, idx) in questionHistory" :key="idx" class="llm-chat-message">
              <div class="llm-chat-question">{{ item.question }}</div>
              <div class="llm-chat-answer">
                <template v-for="(block, bidx) in parseLLMBlocks(item.answer)" :key="bidx">
                  <div v-if="block.type === 'code'" class="llm-code-block-container">
                    <pre class="llm-code-frame"><code>{{ block.content }}</code></pre>
                    <div class="code-block-btn-row">
                      <button class="copy-btn editor-copy-btn" @click="copyBlock(block.content)">Copy</button>
                      <button class="edit-btn" @click="editableCode.value = block.content">Edit</button>
                    </div>
                  </div>
                  <div v-else class="llm-chat-text">{{ block.content }}</div>
                </template>
              </div>
            </div>
          </div>
          <div class="editor-3d-wrapper">
            <label for="llm-3d-editor" class="editor-label">3D Editor</label>
            <textarea id="llm-3d-editor" v-model="editableCode" class="llm-3d-editor" rows="10"
              spellcheck="false"></textarea>
            <div class="editor-btn-row">
              <button class="copy-btn editor-copy-btn" @click="copyEditableCode">Copy Edited</button>
              <button class="insert-btn" @click="showInsertModal = true">Insert to file</button>
              <button class="insert-btn" style="margin-left:0.5rem;" @click="showDiff = !showDiff">{{ showDiff ? 'Hide'
                :
                'Show' }} Diff</button>
            </div>
            <transition name="fade">
              <div v-if="showDiff" class="diff-3d-viewer">
                <div class="diff-3d-title">Diff: LLM Output vs Edited</div>
                <pre class="diff-3d-pre">
        <template v-for="(line, idx) in diffLines" :key="idx">
                    <span :class="['diff-3d-line', line.type]">{{ line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  ' }}{{ line.text }}</span>\n
                  </template>
      </pre>
              </div>
            </transition>
          </div>
          <CodeInsertModal v-if="showInsertModal && response" :show="showInsertModal" :code="editableCode"
            :files="files" @close="showInsertModal = false" @insert="handleInsert" @undo="handleUndo" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: "model" });

// @ts-ignore
// vscode-component-preview
// This comment enables VS Code's component preview for this file.
import CodeInsertModal from '@/components/Ui/CodeInsertModal.vue';
// Remove any import of defineProps or defineEmits, as they are now compiler macros and do not need to be imported
import { generateLLMResponse } from '@/utils/codeLlama';
import { computed, onMounted, ref, watch } from 'vue';

const prompt = ref('');
const response = ref('');
const loadingLLM = ref(false); // Separate loading for LLM
const loadingFiles = ref(false); // Separate loading for files
const error = ref('');
const showInsertModal = ref(false);
const inserted = ref(false);
const files = ref([]); // No placeholder, will be set on mount

const loadedFile = ref({ name: '', code: '' });
let lastInsert = null;

// Prefetch and cache file list on mount
onMounted(async () => {
  loadingFiles.value = true;
  try {
    const res = await fetch('/api/list-files?ext=vue');
    const data = await res.json();
    if (Array.isArray(data.files)) {
      files.value = data.files;
    } else {
      files.value = [];
    }
  } catch (e) {
    files.value = [];
  } finally {
    loadingFiles.value = false;
  }
});

const editableCode = ref('');
const questionHistory = ref([]);
const showDiff = ref(false);
const loadTitle = ref('');

// Debounced watcher for response -> editableCode
let debounceTimer = null;
watch(response, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Only update if response looks like code (contains code block or file context)
    if (val && (val.includes('<code>') || val.includes('```') || val.trim().startsWith('import') || val.trim().startsWith('<template>'))) {
      editableCode.value = val;
    }
  }, 120); // 120ms debounce
});

const diffLines = computed(() => getDiffLines(response.value, editableCode.value));

async function sendPrompt() {
  if (!prompt.value) return;
  loadingLLM.value = true;
  error.value = '';
  response.value = '';
  try {
    const userPrompt = prompt.value;
    prompt.value = '';
    // Optimize prompt for phind-codellama:34b
    let llmInput;
    if (loadedFile.value.code) {
      llmInput = `You are Phind CodeLlama 34B, an expert AI code assistant.\n\nBelow is the code for the file: ${loadedFile.value.name}\n\n<code>\n${loadedFile.value.code}\n</code>\n\nUser question: ${userPrompt}\n\nPlease answer in detail, referencing the code above.`;
    } else {
      llmInput = userPrompt;
    }
    let streamed = '';
    const final = await generateLLMResponse(llmInput, (chunk) => {
      streamed += chunk;
      editableCode.value = formatForEditor(streamed); // Format for 3D Editor
    });
    editableCode.value = formatForEditor(final); // Ensure 3D Editor has formatted answer
    questionHistory.value.push({ question: userPrompt, answer: final, timestamp: new Date() });
  } catch (e) {
    error.value = 'Failed to get response from LLM.';
  } finally {
    loadingLLM.value = false;
  }
}

// Utility: Format LLM output for the 3D Editor (never raw JSON)
function formatForEditor(val) {
  if (!val) return '';
  // Try to parse as JSON and extract code/text if present
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object') {
      if (parsed.code && typeof parsed.code === 'string') return parsed.code;
      if (parsed.text && typeof parsed.text === 'string') return parsed.text;
      // If neither, return empty string (never print raw JSON)
      return '';
    }
  } catch (e) {
    // Not JSON, fall through
  }
  // If it looks like a code block, strip markdown and show code
  if (/^```[\s\S]*```$/.test(val.trim())) {
    return val.trim().replace(/^```[a-zA-Z]*\n?|```$/g, '');
  }
  // Otherwise, return as plain text
  return val;
}

async function loadComponentByTitle() {
  if (!loadTitle.value) return;
  const titleRaw = loadTitle.value.trim();
  let title = titleRaw.toLowerCase();
  if (title.endsWith('.vue')) title = title.slice(0, -4);
  const match = files.value.find(f => {
    const base = f.split('/').pop()?.replace(/\.vue$/, '').toLowerCase();
    return (
      base === title ||
      base + '.vue' === titleRaw.toLowerCase() ||
      f.toLowerCase() === titleRaw.toLowerCase() ||
      f.toLowerCase().endsWith('/' + titleRaw.toLowerCase()) ||
      f.toLowerCase().endswith('/' + title + '.vue')
    );
  });
  if (!match) {
    error.value = `No component found for title: ${loadTitle.value}`;
    return;
  }
  loadingFiles.value = true;
  try {
    error.value = '';
    const res = await fetch(`/api/load-file?path=${encodeURIComponent(match)}`);
    if (!res.ok) throw new Error('Failed to load file');
    const code = await res.text();
    response.value = code;
    editableCode.value = code;
    loadedFile.value = { name: match, code };
    questionHistory.value.push({ question: `Load component: ${loadTitle.value}`, answer: code, timestamp: new Date() });
    const baseName = match.split('/').pop() || match;
    prompt.value = `What does the file ${baseName} do?`;
  } catch (e) {
    error.value = 'Failed to load component file.';
  } finally {
    loadingFiles.value = false;
  }
}

function copyResponse() {
  if (response.value) {
    navigator.clipboard.writeText(response.value);
  }
}

function copyEditableCode() {
  if (editableCode.value) {
    navigator.clipboard.writeText(editableCode.value);
  }
}

async function handleInsert({ file, position }) {
  // Call API or use a composable to insert code into the file
  // For demo, just simulate and store lastInsert
  lastInsert = { file, position, code: response.value };
  inserted.value = true;
  // TODO: Implement actual file write logic via server API if needed
}

async function handleUndo({ file, position }) {
  // Call API or use a composable to undo last insert
  // For demo, just simulate
  if (lastInsert && lastInsert.file === file && lastInsert.position === position) {
    inserted.value = false;
    lastInsert = null;
    // TODO: Implement actual undo logic via server API if needed
  }
}

// Add a formatting function for LLM responses
function formatLLMResponse(text) {
  if (!text) return '';
  // Replace triple backticks with <pre><code>
  let formatted = text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  return formatted;
}

// Parse LLM answer into blocks of text/code for chat-like rendering
function parseLLMBlocks(answer) {
  if (!answer) return [];
  const blocks = [];
  const regex = /```([\w]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(answer))) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: answer.slice(lastIndex, match.index).trim() });
    }
    blocks.push({ type: 'code', content: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < answer.length) {
    blocks.push({ type: 'text', content: answer.slice(lastIndex).trim() });
  }
  // Remove empty text blocks
  return blocks.filter(b => b.content);
}

function copyBlock(content) {
  if (content) navigator.clipboard.writeText(content);
}
</script>

<style scoped>
/* Add a new background layer for the full-page effect */
.llm-3d-bg-fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(135deg, #e0e7ff 0%, #f0f4ff 100%);
  /* Optionally add your SVG/3D canvas here as a child or background-image */
}

.llm-3d-standalone-bg {
  position: relative;
  min-height: 100vh;
  min-width: 100vw;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
}

.llm-3d-container-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  width: 100vw;
  max-width: 1200px;
  gap: 2.5rem;
  padding: 2.5rem 0;
}

.llm-user-col {
  flex: 1 1 320px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  background: rgba(255, 255, 255, 0.65);
  /* More transparent to show 3D background */
  border-radius: 1.5rem;
  box-shadow: 0 6px 24px 0 rgba(80, 80, 255, 0.12);
  padding: 2.2rem 1.7rem 2rem 1.7rem;
  min-height: 380px;
  margin-top: 2.2rem;
  transition: box-shadow 0.18s, background 0.18s;
}

.llm-user-col:focus-within,
.llm-user-col:hover {
  background: rgba(255, 255, 255, 0.80);
  /* Slightly less transparent on hover/focus */
  box-shadow: 0 12px 32px 0 rgba(80, 80, 255, 0.16);
}

.llm-llm-col {
  flex: 2 1 500px;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  min-width: 0;
  width: 100%;
  gap: 1.2rem;
  transition: box-shadow 0.18s, background 0.18s;
  background: rgba(255, 255, 255, 0.55);
  /* More transparent for 3D background */
  border-radius: 1.2rem;
}

@media (max-width: 900px) {
  .llm-llm-col {
    max-width: 98vw;
    align-items: stretch;
    gap: 0.7rem;
  }
}

.llm-3d-card,
.llm-llm-col>.llm-response {
  width: 100%;
}

@media (max-width: 1100px) {
  .llm-3d-container-row {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5rem;
    padding: 1.2rem 0;
  }

  .llm-user-col,
  .llm-llm-col {
    max-width: 98vw;
    margin-top: 0;
    align-items: stretch;
  }

  .llm-llm-col {
    align-items: stretch;
  }
}

.llm-3d-card {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 2.5rem;
  box-shadow:
    0 12px 48px 0 rgba(31, 38, 135, 0.28),
    0 2px 16px 0 rgba(80, 80, 255, 0.13),
    0 0.5px 1.5px 0 rgba(255, 255, 255, 0.25) inset;
  backdrop-filter: blur(18px) saturate(1.2);
  border: 2.5px solid rgba(255, 255, 255, 0.32);
  padding: 3rem 2.2rem 2.2rem 2.2rem;
  max-width: 700px;
  width: 100%;
  transition: box-shadow 0.28s, transform 0.18s;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  position: relative;
  overflow: visible;
}

.llm-3d-card:hover,
.llm-3d-card:focus-within {
  box-shadow:
    0 24px 64px 0 rgba(31, 38, 135, 0.36),
    0 4px 24px 0 rgba(80, 80, 255, 0.18),
    0 1px 3px 0 rgba(255, 255, 255, 0.32) inset;
  transform: translateY(-4px) scale(1.018);
}

.llm-chat-box {
  min-height: 80px;
}

.llm-response {
  background: rgba(240, 247, 255, 0.97);
  border-radius: 1.1rem;
  padding: 1.5rem 1.5rem 2rem 1.5rem;
  margin-bottom: 0.5rem;
  font-family: 'Fira Mono', 'Consolas', monospace;
  color: #1e293b;
  position: relative;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.10);
  border: 1.5px solid #e0e7ef;
}

.llm-code-frame {
  margin: 0.7rem 0 0 0;
  padding: 1.1rem 1.3rem;
  background: linear-gradient(90deg, #f6f8fa 60%, #e0e7ff 100%);
  border-radius: 0.7rem;
  font-size: 1.08rem;
  font-family: 'Fira Mono', 'Consolas', monospace;
  overflow-x: auto;
  white-space: pre;
  max-width: 100%;
  min-height: 2.5em;
  box-sizing: border-box;
  border: 1.5px solid #e0e7ef;
  box-shadow: 0 1px 6px 0 rgba(80, 80, 255, 0.07);
}

.llm-code-frame code {
  display: block;
  white-space: pre;
  word-break: normal;
}

.copy-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: linear-gradient(90deg, #2563eb 60%, #1e40af 100%);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.3rem 0.9rem;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.13);
  transition: background 0.18s, box-shadow 0.18s;
}

.copy-btn:hover {
  background: #1e40af;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.18);
}

.insert-btn {
  margin-top: 1.2rem;
  margin-left: 0.5rem;
  background: linear-gradient(90deg, #22d3ee 60%, #2563eb 100%);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.4rem 1.1rem;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.13);
  transition: background 0.18s, box-shadow 0.18s;
  display: inline-block;
}

.insert-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.18);
}

.llm-error {
  color: #dc2626;
  background: #fef2f2;
  border-radius: 0.7rem;
  padding: 0.9rem 1.2rem;
  margin-bottom: 0.5rem;
  border: 1.5px solid #fca5a5;
}

.llm-loading {
  color: #2563eb;
  font-style: italic;
  padding: 0.7rem 0;
}

.llm-form {
  display: flex;
  gap: 0.7rem;
  align-items: center;
}

.llm-input {
  flex: 1;
  padding: 0.9rem 1.2rem;
  border: 2px solid #cbd5e1;
  border-radius: 1rem;
  font-size: 1.08rem;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.09);
}

.llm-input:focus {
  border: 2px solid #2563eb;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.15);
}

.llm-input-large {
  font-size: 1.22rem;
  padding: 1.2rem 1.5rem;
  border-radius: 1.3rem;
  min-height: 3.2rem;
  background: linear-gradient(90deg, #e0e7ff 60%, #f0f4ff 100%);
  box-shadow: 0 2px 12px 0 rgba(80, 80, 255, 0.10);
  color: #1e293b;
  border: 2.5px solid #c7d2fe;
  transition: border 0.2s, box-shadow 0.2s;
}

.llm-input-large:focus {
  border: 2.5px solid #2563eb;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.15);
  background: linear-gradient(90deg, #f0f4ff 60%, #e0e7ff 100%);
}

@media (max-width: 600px) {
  .llm-input-large {
    font-size: 1.08rem;
    padding: 1rem 1.1rem;
    min-height: 2.5rem;
  }
}

.llm-send-btn {
  background: linear-gradient(90deg, #2563eb 60%, #1e40af 100%);
  color: #fff;
  border: none;
  border-radius: 1rem;
  padding: 0.9rem 1.5rem;
  font-size: 1.08rem;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.13);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.llm-send-btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.spinner {
  width: 1.1em;
  height: 1.1em;
  border: 2.5px solid #fff;
  border-top: 2.5px solid #2563eb;
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.7s linear infinite;
  margin-right: 0.4em;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.llm-history {
  margin-top: 2.2rem;
  background: rgba(240, 247, 255, 0.85);
  border-radius: 1rem;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.07);
  padding: 1.2rem 1rem 1rem 1rem;
  max-height: 40vh;
  /* Use viewport height for auto adjustment */
  min-height: 60px;
  overflow-y: auto;
  transition: max-height 0.2s;
}

@media (max-width: 900px) {
  .llm-history {
    max-height: 30vh;
    padding: 0.8rem 0.5rem 0.7rem 0.5rem;
  }
}

.llm-history-item {
  margin-bottom: 1.1rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid #e0e7ef;
}

.llm-history-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.llm-history-q {
  font-weight: 600;
  color: #2563eb;
  margin-bottom: 0.2rem;
  font-size: 1.05rem;
}

.llm-history-a {
  font-family: 'Fira Mono', 'Consolas', monospace;
  color: #334155;
  font-size: 0.98rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  padding: 0.5rem 0.7rem;
  margin-bottom: 0.2rem;
  word-break: break-word;
}

@media (max-width: 900px) {
  .llm-3d-card {
    padding: 1.5rem 0.7rem 1.2rem 0.7rem;
    border-radius: 1.5rem;
    max-width: 98vw;
  }

  .llm-3d-container {
    padding: 0.5rem 0;
  }
}

@media (max-width: 600px) {
  .llm-3d-container {
    padding: 0.5rem 0;
  }

  .llm-form {
    flex-direction: column;
    gap: 0.5rem;
  }

  .llm-send-btn,
  .llm-input {
    width: 100%;
  }

  .llm-code-frame {
    font-size: 0.95rem;
    padding: 0.6rem 0.6rem;
  }
}

.editor-3d-wrapper {
  margin-top: 2rem;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1.2rem;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18), 0 1.5px 8px 0 rgba(80, 80, 255, 0.10);
  backdrop-filter: blur(10px);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  padding: 2.5rem 2rem 2rem 2rem;
  /* Increased padding */
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.2rem;
  /* Increased gap */
  width: auto;
  min-width: 400px;
  /* Increased min-width */
  max-width: 900px;
  /* Increased max-width */
  box-sizing: border-box;
  resize: both;
  overflow: auto;
}

.editor-label {
  font-weight: 600;
  color: #2563eb;
  margin-bottom: 0.5rem;
  letter-spacing: 0.03em;
}

.llm-3d-editor {
  width: 100%;
  min-width: 350px;
  /* Increased min-width */
  max-width: 100%;
  min-height: 300px;
  /* Increased min-height */
  font-family: 'Fira Mono', 'Consolas', monospace;
  font-size: 1.25rem;
  /* Increased font size */
  background: linear-gradient(120deg, #f0f4ff 60%, #e0e7ff 100%);
  border: 1.5px solid #e0e7ef;
  border-radius: 0.8rem;
  box-shadow: 0 2px 12px 0 rgba(80, 80, 255, 0.10);
  color: #1e293b;
  padding: 1.5rem 1.7rem;
  /* Increased padding */
  outline: none;
  resize: both;
  transition: border 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  overflow: auto;
}

.llm-3d-editor:focus {
  border: 1.5px solid #2563eb;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.15);
}

.editor-copy-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: linear-gradient(90deg, #22d3ee 60%, #2563eb 100%);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.3rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.13);
  transition: background 0.18s, box-shadow 0.18s;
  z-index: 2;
}

.editor-copy-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.18);
}

.diff-3d-viewer {
  margin-top: 1.5rem;
  background: linear-gradient(120deg, #e0e7ff 60%, #f0f4ff 100%);
  border-radius: 1.1rem;
  box-shadow: 0 4px 24px 0 rgba(80, 80, 255, 0.13);
  border: 1.5px solid #c7d2fe;
  padding: 1.2rem 1.2rem 1.2rem 1.2rem;
  font-family: 'Fira Mono', 'Consolas', monospace;
  color: #1e293b;
  max-height: 320px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.diff-3d-title {
  font-weight: 700;
  color: #2563eb;
  margin-bottom: 0.7rem;
  font-size: 1.08rem;
  letter-spacing: 0.02em;
}

.diff-3d-pre {
  background: transparent;
  padding: 0;
  margin: 0;
  border: none;
  font-size: 1.01rem;
  line-height: 1.6;
  white-space: pre;
}

.diff-3d-line {
  display: block;
  padding: 0.1rem 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.18s;
}

.diff-3d-line.add {
  background: linear-gradient(90deg, #d1fae5 60%, #a7f3d0 100%);
  color: #047857;
}

.diff-3d-line.remove {
  background: linear-gradient(90deg, #fee2e2 60%, #fecaca 100%);
  color: #b91c1c;
}

.diff-3d-line.equal {
  background: transparent;
  color: #334155;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.llm-chat-thread {
  width: 100%;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.llm-chat-message {
  background: #f8fafc;
  border-radius: 1.1rem;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.07);
  padding: 1.2rem 1.2rem 1.2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.llm-chat-question {
  color: #2563eb;
  font-weight: 600;
  margin-bottom: 0.3rem;
  font-size: 1.08rem;
}

.llm-chat-answer {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.llm-chat-text {
  color: #1e293b;
  font-size: 1.05rem;
  line-height: 1.7;
  white-space: pre-wrap;
}

.llm-code-block-container {
  position: relative;
  margin: 0.7rem 0;
  background: #f6f8fa;
  border-radius: 0.7rem;
  border: 1.5px solid #e0e7ef;
  box-shadow: 0 1px 6px 0 rgba(80, 80, 255, 0.07);
  padding: 1.1rem 1.3rem 2.2rem 1.3rem;
}

.llm-code-block-container .copy-btn {
  top: 1.1rem;
  right: 1.1rem;
}

.llm-code-block-container .edit-btn {
  position: absolute;
  top: 1.1rem;
  right: 5.5rem;
  background: linear-gradient(90deg, #22d3ee 60%, #2563eb 100%);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.3rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 255, 0.13);
  transition: background 0.18s, box-shadow 0.18s;
  z-index: 2;
}

.llm-code-block-container .edit-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 16px 0 rgba(80, 80, 255, 0.18);
}

.responsive-chat-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  width: 100vw;
  max-width: 1400px;
  gap: 2.5rem;
  padding: 2.5rem 0;
}

.chat-col {
  flex: 1 1 420px;
  min-width: 320px;
  max-width: 520px;
  width: 100%;
  box-sizing: border-box;
}

.editor-col {
  flex: 1 1 520px;
  min-width: 320px;
  max-width: 700px;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 1100px) {
  .responsive-chat-layout {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5rem;
    padding: 1.2rem 0;
  }

  .chat-col,
  .editor-col {
    max-width: 98vw;
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 700px) {
  .responsive-chat-layout {
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.5rem 0;
  }

  .chat-col,
  .editor-col {
    max-width: 100vw;
    min-width: 0;
    width: 100%;
    padding: 0;
  }
}

.code-block-btn-row {
  display: flex;
  gap: 0.7rem;
  margin-top: 0.5rem;
  justify-content: flex-end;
}

.editor-btn-row {
  display: flex;
  gap: 0.7rem;
  margin-top: 1.1rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.llm-code-block-container .copy-btn {
  position: static;
  margin: 0;
}

.llm-code-block-container .edit-btn {
  position: static;
  margin: 0;
}
</style>
