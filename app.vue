<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Nothing needed here unless injecting global logic
</script>

<style>
/* Apply global resets and fallback background */
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
  background-color: #7ec0ee; /* fallback sky-blue if Vanta fails */
}
</style>
