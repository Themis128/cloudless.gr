<template>
  <DebugInspector :data="pipelineStatus" title="Pipeline Status" />
  <DebugLogsViewer :logs="pipelineLogs" />
</template>
<script setup lang="ts">
import { ref } from 'vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';
import DebugLogsViewer from '~/components/debug/DebugLogsViewer.vue';

const pipelineStatus = ref({ step: 'Data Cleanse', complete: 3, failed: 0 });
const pipelineLogs = ref(['Step 1 complete.', 'Step 2 complete.']);
</script>
