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
import { ref } from '#imports'
import { onMounted } from '#imports'

const connectionStatus = ref<{ status: 'success' | 'error'; message: string } | null>(null)

async function checkSupabaseConnection() {
  try {
    if (!supabase) {
      throw new Error('Supabase client is not initialized')
    }
    const { error } = await supabase.from('_test_connection_').select('*').limit(1)

    if (error && error.code === 'PGRST116') {
      connectionStatus.value = { status: 'success', message: 'Connected successfully ✅' }
    } else if (error) {
      throw error
    } else {
      connectionStatus.value = { status: 'success', message: 'Connected successfully ✅' }
    }
  } catch (error: any) {
    console.error('Supabase connection error:', error)
    connectionStatus.value = {
      status: 'error',
      message: `Connection failed: ${error.message || 'Unknown error'} ❌`
    }
  }
}

onMounted(checkSupabaseConnection)
</script>

<style>
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
