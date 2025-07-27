<template>
  <div class="test-page">
    <div class="container">
      <h1>Basic App Test</h1>
      <p>This page tests if the basic Nuxt 3 app is working without Vuetify.</p>
      
      <div class="card">
        <h2>Status</h2>
        <p class="success">✅ Basic app is working!</p>
        <button @click="testClick" class="btn btn-primary">
          Test Button Click
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const testClick = () => {
  alert('Button click is working!')
}
</script>

<style scoped>
.test-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.container {
  text-align: center;
  max-width: 600px;
  padding: 2rem;
}

.card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  margin-top: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.success {
  color: #4CAF50;
  font-weight: bold;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
}

.btn-primary {
  background: #1976D2;
  color: white;
}

.btn-primary:hover {
  background: #1565C0;
  transform: translateY(-2px);
}
</style> 