<template>
  <div class="static-asset-page">
    <h1>Gallery Directory</h1>
    <p>This directory contains static assets for the Cloudless.gr website.</p>
    <NuxtLink to="/" class="home-link">Return to Home</NuxtLink>
  </div>
</template>

<script setup lang="ts">
// This page exists to prevent Vue Router warnings for static assets in the /gallery directory
</script>

<script lang="ts">
export default {
  layout: 'default',
};
</script>

<style scoped>
.static-asset-page {
  max-width: 800px;
  margin: 3rem auto;
  padding: 2rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 1rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

.home-link {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.5rem 1.5rem;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  color: white;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 500;
  transition: transform 0.2s;
}

.home-link:hover {
  transform: translateY(-2px);
}
</style>
