<template>
  <div></div>
</template>

<script setup lang="ts">
// Redirect /auth/login to /auth since auth/index.vue is the actual login page
navigateTo('/auth', { replace: true })
</script>
