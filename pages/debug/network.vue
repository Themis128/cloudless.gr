<template>
  <DebugConsole title="Ping API Server" />
  <DebugInspector :data="networkState" title="Network State" />
</template>
<script setup lang="ts">
import { ref } from 'vue';
import DebugConsole from '~/components/debug/DebugConsole.vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';

const networkState = ref({ status: 'online', latency: '34ms' });
</script>
