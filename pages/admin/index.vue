<template>
  <div class="d-flex justify-center align-center" style="min-height: 200px">
    <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    <div class="ml-4">
      <h3>Redirecting to Admin Dashboard...</h3>
      <p class="text-medium-emphasis">Please wait while we load the admin panel.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue';

  // Redirect to the admin dashboard using client-side navigation
  onMounted(() => {
    // Use timeout to ensure the page is mounted before redirecting
    setTimeout(() => {
      if (process.client) {
        window.location.href = '/admin/dashboard';
      }
    }, 500);
  });
</script>
