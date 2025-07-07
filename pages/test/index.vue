<template>
  <div class="test-navigation-page">
    <h1>Navigation Test Page</h1>
    <p>This page is used for testing the centralized navigation system.</p>
    
    <div class="navigation-info">
      <h2>Current Navigation State</h2>
      <div id="nav-state">
        <p><strong>Current URL:</strong> {{ currentUrl }}</p>
        <p><strong>Base URL:</strong> {{ baseUrl }}</p>
        <p><strong>Navigation Store Loaded:</strong> {{ navigationStoreLoaded }}</p>
      </div>
    </div>

    <div class="test-actions">
      <h3>Test Navigation Actions</h3>
      <div class="button-group">
        <button class="test-btn" @click="navigateToAuth">Navigate to Auth</button>
        <button class="test-btn" @click="navigateToAuthWithRedirect">Auth with Redirect</button>
        <button class="test-btn" @click="navigateToUsers">Navigate to Users</button>
        <button class="test-btn" @click="testUrlBuilding">Test URL Building</button>
      </div>
    </div>

    <div class="test-results">
      <h3>Test Results</h3>
      <div id="test-results">
        <pre>{{ testResults }}</pre>
      </div>
    </div>

    <div id="route-categories" class="route-categories">
      <h3>Available Route Categories</h3>
      <ul>
        <li v-for="category in routeCategories" :key="category">{{ category }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// Navigation store composable
const { $router } = useNuxtApp()

// Reactive data
const currentUrl = ref('')
const baseUrl = ref('')
const navigationStoreLoaded = ref(false)
const testResults = ref({})
const routeCategories = ref(['auth', 'dashboard', 'users', 'settings', 'public'])

// Check if navigation store is loaded
onMounted(() => {
  currentUrl.value = window.location.href
  baseUrl.value = window.location.origin
  
  // Check if our navigation store functions are available
  try {
    // This will be replaced by actual navigation store integration
    navigationStoreLoaded.value = true
  } catch {
    navigationStoreLoaded.value = false
  }
})

// Navigation actions
const navigateToAuth = () => {
  testResults.value.authNavigation = 'Attempting to navigate to auth...'
  $router.push('/auth')
}

const navigateToAuthWithRedirect = () => {
  testResults.value.authWithRedirect = 'Attempting to navigate to auth with redirect...'
  $router.push('/auth?redirect=/users')
}

const navigateToUsers = () => {
  testResults.value.usersNavigation = 'Attempting to navigate to users...'
  $router.push('/users')
}

const testUrlBuilding = () => {
  testResults.value.urlBuilding = {
    timestamp: new Date().toISOString(),
    baseUrl: baseUrl.value,
    currentUrl: currentUrl.value,
    testPassed: true
  }
}

// Page metadata
useHead({
  title: 'Navigation Test Page',
  meta: [
    { name: 'description', content: 'Test page for centralized navigation system' }
  ]
})
</script>

<style scoped>
.test-navigation-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
}

.navigation-info,
.test-actions,
.test-results,
.route-categories {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background-color: #f8fafc;
}

.button-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.test-btn {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.test-btn:hover {
  background-color: #2563eb;
}

#test-results pre {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

h1, h2, h3 {
  color: #1f2937;
  margin-bottom: 1rem;
}

ul {
  list-style-type: disc;
  padding-left: 1.5rem;
}

li {
  margin-bottom: 0.5rem;
}
</style>