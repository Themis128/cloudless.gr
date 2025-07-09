<template>
  <DebugConsole title="Test Model Inference" />
  <DebugInspector :data="modelInfo" title="Model Details" />
</template>
<script setup lang="ts">
import { ref } from 'vue';
import DebugConsole from '~/components/debug/DebugConsole.vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';

const modelInfo = ref({ version: 'v1.2', status: 'ready', params: {} });
</script>
