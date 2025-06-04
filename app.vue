<template>
  <NuxtLayout>
    <div v-if="connectionStatus" class="connection-status" :class="connectionStatus.status">
      Supabase Connection: {{ connectionStatus.message }}
    </div>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { supabase } from './utils/supabase'
import { ref, onMounted } from 'vue'

const connectionStatus = ref<{ status: 'success' | 'error', message: string } | null>(null)

async function checkSupabaseConnection() {
  try {
    // Try to connect to Supabase by making a simple query
    const { data, error } = await supabase.from('_test_connection_').select('*').limit(1)
    
    if (error && error.code === 'PGRST116') {
      // This error means the table doesn't exist, but the connection works
      connectionStatus.value = {
        status: 'success',
        message: 'Connected successfully'
      }
    } else if (error) {
      throw error
    } else {
      connectionStatus.value = {
        status: 'success',
        message: 'Connected successfully'
      }
    }
  } catch (error) {
    console.error('Supabase connection error:', error)
    connectionStatus.value = {
      status: 'error',
      message: `Connection failed: ${error.message || 'Unknown error'}`
    }
  }
}

onMounted(() => {
  checkSupabaseConnection()
})
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
  background-color: #f5f5f5;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.15s ease-out;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  border-radius: 4px;
  z-index: 1000;
  font-weight: 500;
}

.connection-status.success {
  background-color: #4caf50;
  color: white;
}

.connection-status.error {
  background-color: #f44336;
  color: white;
}
</style>
