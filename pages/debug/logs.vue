<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">System Logs</v-card-title>
          <v-card-text>
            <DebugLogsViewer :logs="systemLogs" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const systemLogs = ref<string[]>([
  'Service started...',
  'Connection established...',
  'Auth token refreshed.'
]);

onMounted(() => {
  // Simulate dynamic log update
  systemLogs.value.push('Log viewer initialized.');
});
</script>
