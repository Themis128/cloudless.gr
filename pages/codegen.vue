<template>
  <div class="codegen-container">
    <h1>CodeLlama Code Generation</h1>
    <textarea
      v-model="prompt"
      placeholder="Enter your prompt for Codellama..."
      rows="5"
      class="codegen-textarea"
    ></textarea>
    <button @click="askLLM" :disabled="loading" class="codegen-btn">
      Generate Code
    </button>
    <div v-if="loading">Generating...</div>
    <pre
      v-if="response"
      class="codegen-result"
    ><code>{{ response }}</code></pre>
    <div v-if="error" class="codegen-error">{{ error }}</div>
    <MyGeneratedComponent></MyGeneratedComponent>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MyGeneratedComponent from '../components/MyGeneratedComponent.vue';

const prompt = ref<string>(""); // Declare 'prompt' as a reactive reference
const response = ref("");
const loading = ref(false);
const error = ref("");

const askLLM = async () => {
  loading.value = true;
  error.value = "";
  response.value = "";
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.value }),
    });
    if (!res.ok) throw new Error("Failed to fetch from LLM API");
    const data = await res.json();
    response.value = data.response || data.result || JSON.stringify(data);
  } catch (e) {
    error.value = "Error: " + ((e as Error).message || e);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.codegen-container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: var(--color-bg, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.codegen-textarea {
  width: 100%;
  margin-bottom: 1rem;
  padding: 0.75rem;
  font-size: 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
}
.codegen-btn {
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  background: #007bff;
  color: #fff;
  border: none;
  cursor: pointer;
}
.codegen-btn:disabled {
  background: #aaa;
  cursor: not-allowed;
}
.codegen-result {
  margin-top: 1.5rem;
  background: #f6f8fa;
  padding: 1rem;
  border-radius: 6px;
  font-family: monospace;
  white-space: pre-wrap;
}
.codegen-error {
  color: #c00;
  margin-top: 1rem;
}
</style>
