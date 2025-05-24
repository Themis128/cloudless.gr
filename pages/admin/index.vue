<template>
  <div>
    <p>Redirecting to admin dashboard...</p>
  </div>
</template>

<script setup>
// This page just redirects to the contact submissions
onMounted(() => {
  navigateTo('/admin/contact-submissions');
});
</script>
