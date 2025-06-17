<template>
  <div class="test-page">
    <h1>Navigation Test Page</h1>
    <p>This page tests different navigation methods:</p>
    
    <div class="test-buttons">
      <h2>Test 1: NuxtLink + v-btn</h2>
      <NuxtLink to="/auth" class="text-decoration-none">
        <v-btn color="primary" size="large">
          NuxtLink to Auth
        </v-btn>
      </NuxtLink>
      
      <h2>Test 2: v-btn with to prop</h2>
      <v-btn to="/auth" color="secondary" size="large">
        v-btn to Auth
      </v-btn>
      
      <h2>Test 3: v-btn with @click</h2>
      <v-btn color="success" size="large" @click="goToAuth">
        @click to Auth
      </v-btn>
      
      <h2>Test 4: Regular button</h2>
      <button style="padding: 12px 24px; font-size: 16px;" @click="goToAuth">
        Regular Button to Auth
      </button>
      
      <h2>Test 5: Direct link</h2>
      <a href="/auth" style="padding: 12px 24px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px;">
        Direct Link to Auth
      </a>
    </div>
    
    <div class="debug-info">
      <h2>Debug Info:</h2>
      <p>Current Route: {{ $route.path }}</p>
      <p>Navigation available: {{ typeof navigateTo !== 'undefined' }}</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'default' })

const goToAuth = () => {
  console.log('Navigating to /auth via navigateTo')
  navigateTo('/auth')
}
</script>

<style scoped>
.test-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-buttons > * {
  margin: 10px;
  display: block;
}

.debug-info {
  margin-top: 40px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}
</style>
