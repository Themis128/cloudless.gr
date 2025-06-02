<template>
  <div class="llm-demo-page">
    <div class="page-header">
      <h1>LLM Integration Demo</h1>
      <p class="description">
        This demo showcases the integration with Ollama using the phind-codellama:34b model.
        Try asking questions or generating code!
      </p>
    </div>

    <LLMDemo />
  </div>
</template>

<script setup lang="ts">
import LLMDemo from '@/components/demo/LLMDemo.vue';
</script>

<style scoped>
.llm-demo-page {
  min-height: 100vh;
  padding: 2rem 1rem;
}

.page-header {
  text-align: center;
  max-width: 800px;
  margin: 0 auto 3rem;
}

h1 {
  color: #1e40af;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.description {
  color: #64748b;
  font-size: 1.1rem;
  line-height: 1.6;
}
</style>
