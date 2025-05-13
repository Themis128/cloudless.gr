<template>
  <div class="codegen-page-wrapper">
    <h1 class="codegen-title">AI Code Generation Workspace</h1>
    <section class="codegen-main-section">
      <MyGeneratedComponent />
    </section>
  </div>
</template>

<script setup lang="ts">
import MyGeneratedComponent from '../components/MyGeneratedComponent.vue';
definePageMeta({ layout: 'model' });
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
