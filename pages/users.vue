<template>
  <div>
    <p>Redirecting to user management...</p>
  </div>
</template>

<script setup>
// Redirect to admin users page
await navigateTo('/admin/users')
</script>
