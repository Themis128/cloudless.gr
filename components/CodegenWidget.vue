<template>
    <div class="codegen-page-wrapper">
        <h1 class="codegen-title">AI Code Generation Workspace</h1>
        <section class="codegen-main-section">
            <!-- Simple LLM chat UI using the composable -->
            <div style="margin-top:2.5rem;max-width:520px;width:100%;">
                <form @submit.prevent="handleSend" style="display:flex;gap:0.5rem;">
                    <input v-model="prompt" :disabled="loading" placeholder="Ask the LLM anything..."
                        style="flex:1;padding:0.8rem 1.1rem;border-radius:1rem;border:1.5px solid #c7d2fe;font-size:1.08rem;outline:none;" />
                    <button type="submit" :disabled="loading || !prompt"
                        style="background:linear-gradient(90deg,#22d3ee 60%,#2563eb 100%);color:#fff;border:none;border-radius:1rem;padding:0.8rem 1.5rem;font-size:1.08rem;cursor:pointer;">
                        {{ loading ? '...' : 'Send' }}
                    </button>
                </form>
                <div v-if="error"
                    style="color:#dc2626;background:#fef2f2;border-radius:0.7rem;padding:0.7rem 1rem;margin-top:0.5rem;border:1.5px solid #fca5a5;">
                    {{ error }}
                </div>
                <div v-if="response"
                    style="background:#f8fafc;border-radius:0.7rem;padding:1rem 1.2rem;margin-top:1rem;color:#1e293b;font-family:'Fira Mono','Consolas',monospace;">
                    {{ response }}
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { useLLM } from '@/composables/useLLM';
import { ref } from 'vue';

const prompt = ref('');
const { response, loading, error, sendPrompt } = useLLM();

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
    text-shadow: 0 2px 12px rgba(80, 80, 255, 0.08);
}

.codegen-main-section {
    width: 100%;
    max-width: 1600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
</style>
