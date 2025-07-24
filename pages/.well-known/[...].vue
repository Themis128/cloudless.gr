<template>
  <div>
    <!-- This page handles .well-known requests to prevent Vue Router warnings -->
  </div>
</template>

<script setup>
// This page exists solely to prevent Vue Router warnings for .well-known paths
// The actual handling is done by the server-side API at server/api/.well-known/[...].get.ts

// Redirect to home page since these are typically API requests
await navigateTo('/')
</script> 