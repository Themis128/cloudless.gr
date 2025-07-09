<template>
  <div class="app-layout">
    <header class="app-header">
      <h1>Cloudless</h1>
    </header>
    <main class="app-main">
      <slot />
    </main>
    <footer class="app-footer">
      <span>&copy; 2025 Cloudless</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
// You can add global composables or logic here if needed
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f7fa;
}
.app-header {
  background: #222;
  color: #fff;
  padding: 1rem 2rem;
  text-align: center;
  letter-spacing: 2px;
}
.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}
.app-footer {
  background: #222;
  color: #fff;
  text-align: center;
  padding: 1rem 2rem;
  font-size: 0.95rem;
}
</style>
