<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-h5">Test Model Inference</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="input"
              label="Input for inference"
              @keyup.enter="runInference"
              append-inner-icon="mdi-play"
              @click:append-inner="runInference"
            />
            <DebugConsole :output="output" title="Model Output" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-h6">Model Details</v-card-title>
          <v-card-text>
            <DebugInspector :data="modelInfo" />
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

const input = ref('');
const output = ref('');
const modelInfo = ref({ version: 'v1.2', status: 'ready', params: { layers: 12, size: '1.3B' } });

onMounted(() => {
  modelInfo.value.status = 'warming up...';
  setTimeout(() => {
    modelInfo.value.status = 'ready';
  }, 1000);
});

function runInference() {
  output.value = input.value ? `Echo: ${input.value}` : '';
  input.value = '';
}
</script>
