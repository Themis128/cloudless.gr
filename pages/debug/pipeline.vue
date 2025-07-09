<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="text-h5 d-flex align-center justify-space-between">
            Pipeline Status
            <v-btn color="primary" @click="runAll">Run Pipeline</v-btn>
          </v-card-title>
          <v-card-text>
            <DebugInspector :data="pipelineStatus" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="text-h6">Pipeline Logs</v-card-title>
          <v-card-text>
            <DebugLogsViewer :logs="pipelineLogs" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted } from 'vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';
import DebugLogsViewer from '~/components/debug/DebugLogsViewer.vue';
import { usePipelineDebug } from '~/composables/usePipelineDebug';

const { pipelineStatus, pipelineLogs, runAll } = usePipelineDebug();
onMounted(() => runAll());
</script>
