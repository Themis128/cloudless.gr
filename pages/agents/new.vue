<!--
  This page can host:
  - A UI for creating a new AI agent (form or wizard)
  - Natural language prompt input, template selection, and tool connectors (email, API, DB, etc.)
  - Save agent config to versioned backend (Git or DB)
  - Security: Only accessible to authorized users
-->
<template>
  <div />
</template>

<script setup lang="ts">
// Creating new agents requires Pro plan
definePageMeta({
  requiresPro: true
})
</script>
