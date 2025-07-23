<template>
  <div class="llm-index">
    <h1>LLMs</h1>
    <NuxtLink to="/llm/local">
      <button>Manage Local LLMs</button>
    </NuxtLink>
  </div>
</template>

<script setup>
// No logic needed for now
</script>

<style scoped>
.llm-index {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
button {
  margin-top: 2rem;
  padding: 1rem 2rem;
  font-size: 1.2rem;
  border-radius: 8px;
  background: #4f8cff;
  color: white;
  border: none;
  cursor: pointer;
}
button:hover {
  background: #2563eb;
}
</style>