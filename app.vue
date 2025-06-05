<template>
  <NuxtLayout>
    <div v-if="connectionStatus" class="connection-status" :class="[connectionStatus.status, colorMode.value]">
      Supabase Connection: {{ connectionStatus.message }}
      <v-btn v-if="connectionStatus.status === 'error'" icon="mdi-refresh" size="small" variant="text" class="ml-2" @click="checkSupabaseConnection">
        <v-tooltip activator="parent" location="bottom">Retry connection</v-tooltip>
      </v-btn>
    </div>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from '#imports'
import { useColorMode } from '@vueuse/core'

interface ConnectionStatus {
  status: 'success' | 'error'
  message: string
}

const connectionStatus = ref<ConnectionStatus | null>(null)
const colorMode = useColorMode()
let connectionCheckInterval: NodeJS.Timeout | null = null

async function checkSupabaseConnection() {
  try {
    const supabase = useSupabaseClient()
    if (!supabase) {
      connectionStatus.value = {
        status: 'error',
        message: 'Supabase client not initialized'
      }
      return
    }

    const { error } = await supabase.from('contact_submissions').select('count').limit(0)

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    connectionStatus.value = { 
      status: 'success', 
      message: 'Connected successfully ✅' 
    }
  } catch (error) {
    console.error('Supabase connection error:', error)
    connectionStatus.value = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

// Set up periodic connection check
onMounted(() => {
  checkSupabaseConnection()
  connectionCheckInterval = setInterval(checkSupabaseConnection, 300000) // Check every 5 minutes
})

// Clean up on component unmount
onUnmounted(() => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval)
  }
})
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
  display: flex;
  align-items: center;
  backdrop-filter: blur(8px);
}

.connection-status.success {
  background-color: rgb(76 175 80 / 90%);
  color: white;
}

.connection-status.error {
  background-color: rgb(244 67 54 / 90%);
  color: white;
}

/* Dark mode styles */
.connection-status.dark {
  box-shadow: 0 2px 8px rgb(0 0 0 / 30%);
}

.connection-status.dark.success {
  background-color: rgb(56 142 60 / 90%);
}

.connection-status.dark.error {
  background-color: rgb(211 47 47 / 90%);
}

/* Light mode styles */
.connection-status.light {
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.connection-status.light.success {
  background-color: rgb(76 175 80 / 90%);
}

.connection-status.light.error {
  background-color: rgb(244 67 54 / 90%);
}
</style>
