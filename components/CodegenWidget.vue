<template>
  <div class="codegen-page-wrapper">
    <h1 class="codegen-title">AI Code Generation Workspace</h1>
    <section class="codegen-main-section">
      <!-- Simple LLM chat UI using the composable -->
      <div style="margin-top: 2.5rem; max-width: 520px; width: 100%">
        <form @submit.prevent="handleSend" style="display: flex; gap: 0.5rem">
          <input v-model="prompt" :disabled="loading" placeholder="Ask the LLM anything..." style="
              flex: 1;
              padding: 0.8rem 1.1rem;
              border-radius: 1rem;
              border: 1.5px solid #c7d2fe;
              font-size: 1.08rem;
              outline: none;
            " />
          <button type="submit" :disabled="loading || !prompt" style="
              background: linear-gradient(90deg, #22d3ee 60%, #2563eb 100%);
              color: #fff;
              border: none;
              border-radius: 1rem;
              padding: 0.8rem 1.5rem;
              font-size: 1.08rem;
              cursor: pointer;
            ">
            {{ loading ? '...' : 'Send' }}
          </button>
        </form>
        <div v-if="error" style="
            color: #dc2626;
            background: #fef2f2;
            border-radius: 0.7rem;
            padding: 0.7rem 1rem;
            margin-top: 0.5rem;
            border: 1.5px solid #fca5a5;
          ">
          {{ error }}
        </div>
        <div v-if="response" style="
            background: #f8fafc;
            border-radius: 0.7rem;
            padding: 1rem 1.2rem;
            margin-top: 1rem;
            color: #1e293b;
            font-family: 'Fira Mono', Consolas, monospace;
          ">
          {{ response }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useLLMAndFileViewer } from '@/composables/useLLMAndFileViewer';
import { ref } from 'vue';

const prompt = ref('');
const { response, loading, error, sendPrompt } = useLLMAndFileViewer();

async function handleSend() {
  if (!prompt.value) return;
  await sendPrompt(prompt.value, () => { });
  prompt.value = '';
}
</script>

<style scoped>
.codegen-page-wrapper {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 2.5rem;
  box-sizing: border-box;
}

.codegen-title {
  font-size: 2.1rem;
  font-weight: 700;
  color: #2563eb;
  margin-bottom: 2.2rem;
  letter-spacing: 0.01em;
  text-align: center;
  text-shadow: 0 2px 12px rgb(80 80 255 / 8%);
}

.codegen-main-section {
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1.5rem;
  box-shadow: 0 4px 32px 0 rgb(80 80 255 / 10%);
  padding: 2.5rem 2rem;
  margin: 0 auto;
  backdrop-filter: blur(8px);
  transition: box-shadow 0.2s;
}

.codegen-main-section:focus-within,
.codegen-main-section:hover {
  box-shadow: 0 8px 48px 0 rgb(80 80 255 / 18%);
}

.codegen-main-section,
.codegen-title,
.codegen-page-wrapper {
  font-family: Consolas, Courier New, monospace;
}

.background-3d {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.codegen-main-section pre,
.codegen-main-section code {
  word-break: break-all;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .codegen-page-wrapper {
    padding-top: 1.5rem;
  }

  .codegen-main-section {
    padding: 1.5rem 0.5rem;
  }
}

@media (max-width: 600px) {
  .codegen-main-section {
    padding: 1rem 0.25rem;
    font-size: 0.98rem;
  }

  .codegen-title {
    font-size: 1.3rem;
  }

  .codegen-page-wrapper {
    padding-top: 1rem;
  }
}
</style>
