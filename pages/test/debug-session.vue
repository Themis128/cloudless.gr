<template>
  <div class="debug-session">
    <h1>Session Debug Page</h1>
    
    <div class="section">
      <h2>Storage Keys Check</h2>
      <pre>{{ storageData }}</pre>
    </div>
    
    <div class="section">
      <h2>Supabase Client Check</h2>
      <pre>{{ clientData }}</pre>
    </div>
    
    <div class="section">
      <h2>Actions</h2>
      <button @click="checkStorage">Refresh Storage Check</button>
      <button @click="clearStorage">Clear All Storage</button>
      <button @click="testNavigate">Test Navigate to /users/index</button>
    </div>
  </div>
</template>

<script setup>
import { useManualSupabaseClient } from '~/composables/useManualSupabase'

const storageData = ref({})
const clientData = ref({})

const checkStorage = () => {
  if (process.client) {
    const hostname = new URL('http://192.168.0.23:54321').hostname
    const correctStorageKey = `sb-${hostname}-auth-token`
    
    storageData.value = {
      correctKey: correctStorageKey,
      correctKeyExists: !!localStorage.getItem(correctStorageKey),
      correctKeyValue: localStorage.getItem(correctStorageKey),
      manualKeyExists: !!localStorage.getItem('sb-manual-auth-token'),
      manualKeyValue: localStorage.getItem('sb-manual-auth-token'),
      defaultKeyExists: !!localStorage.getItem('sb-localhost-auth-token'),
      defaultKeyValue: localStorage.getItem('sb-localhost-auth-token'),
      allKeys: Object.keys(localStorage).filter(key => key.startsWith('sb-'))
    }
  }
}

const checkClient = async () => {
  try {
    const client = useManualSupabaseClient()
    const session = await client.auth.getSession()
    const user = await client.auth.getUser()
    
    clientData.value = {
      hasClient: !!client,
      sessionExists: !!session.data.session,
      sessionUser: session.data.session?.user?.email || null,
      userExists: !!user.data.user,
      userEmail: user.data.user?.email || null,
      sessionError: session.error?.message || null,
      userError: user.error?.message || null
    }
  } catch (error) {
    clientData.value = { error: error.message }
  }
}

const clearStorage = () => {
  if (process.client) {
    const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith('sb-'))
    keysToRemove.forEach(key => localStorage.removeItem(key))
    sessionStorage.clear()
    checkStorage()
    checkClient()
  }
}

const testNavigate = async () => {
  try {
    await navigateTo('/users/index')
  } catch (error) {
    console.error('Navigation failed:', error)
  }
}

onMounted(() => {
  checkStorage()
  checkClient()
})
</script>

<style scoped>
.debug-session {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}

button {
  margin: 5px;
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}
</style>
