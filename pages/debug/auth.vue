<template>
  <DebugInspector :data="authState" title="Auth State" />
  <DebugLogsViewer :logs="authLogs" />
</template>
<script setup lang="ts">
import { ref } from 'vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';
import DebugLogsViewer from '~/components/debug/DebugLogsViewer.vue';

const authState = ref({ user: null, session: null }); // Fill with actual supabase auth state
const authLogs = ref(['Attempting login...', 'Token expired...']); // Sample logs
</script>
