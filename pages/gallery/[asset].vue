<template>
  <div class="static-asset-page">
    <h1>Static Asset</h1>
    <p>
      The file <code>{{ $route.params.asset }}</code> is a static asset, not a page.
    </p>
    <div class="asset-info">
      <p>You might be looking for an image. Here it is:</p>
      <img :src="`/gallery/${$route.params.asset}`" alt="Asset" class="asset-preview" />
    </div>
    <NuxtLink to="/" class="home-link">Return to Home</NuxtLink>
  </div>
</template>

<script setup lang="ts">
// This dynamic route provides a fallback for static assets in the /gallery directory
// For example, accessing /gallery/noise.png as a route will show this page
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

.asset-info {
  margin: 2rem 0;
}

.asset-preview {
  max-width: 100%;
  max-height: 300px;
  margin: 1rem auto;
  border-radius: 0.5rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

code {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-family: monospace;
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
