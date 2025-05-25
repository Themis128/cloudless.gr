<template>
  <div>
    <p>Redirecting to admin dashboard...</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

// Redirect to the admin dashboard
onMounted(async (): Promise<void> => {
  await navigateTo('/admin/dashboard');
});
</script>
