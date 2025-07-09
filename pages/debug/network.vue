<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-h5 d-flex align-center justify-space-between">
            Ping API Server
            <v-btn icon @click="ping" :loading="loading" :disabled="loading">
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <DebugConsole :output="logOutput" title="Ping Log" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-h6">Network State</v-card-title>
          <v-card-text>
            <DebugInspector :data="networkState" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DebugConsole from '~/components/debug/DebugConsole.vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';

const networkState = ref<{ status: string; latency: string | null }>({ status: 'checking...', latency: null });
const logOutput = ref('');
const loading = ref(false);

async function ping() {
  loading.value = true;
  const start = Date.now();
  logOutput.value += `Pinging API server...\n`;
  try {
    await fetch('http://127.0.0.1:54321/health');
    const latency = Date.now() - start;
    networkState.value = { status: 'online', latency: `${latency}ms` };
    logOutput.value += `✅ Online (${latency}ms)\n`;
  } catch (error) {
    networkState.value = { status: 'offline', latency: 'N/A' };
    logOutput.value += `❌ Offline\n`;
  }
  loading.value = false;
}

onMounted(() => {
  ping();
});
</script>
