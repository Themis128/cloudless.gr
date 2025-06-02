<template>
  <NuxtLayout name="agent-platform">
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// No script logic needed at this time.
</script>

<style>
  html,
  body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    overflow-x: hidden;
    background-color: #f5f5f5;
  }

  .page-enter-active,
  .page-leave-active {
    transition: all 0.15s ease-out;
  }

  .page-enter-from,
  .page-leave-to {
    opacity: 0;
    transform: translateY(-20px);
  }
</style>
