<template>
  <div class="index-page">
    <LayoutHero />
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { useHead, useSeoMeta } from '#app';

useHead({ title: 'Cloudless | Full Stack Web Developer' });

useSeoMeta({
  description: 'A showcase of projects and services at Cloudless, a full-stack developer studio.'
});
</script>

<style scoped>
.index-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem 0;
  min-height: 100vh;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .index-page {
    padding: 1.5rem 0.5rem;
    gap: 1.5rem;
  }
}

@media (max-width: 600px) {
  .index-page {
    padding: 1rem 0.25rem;
    gap: 1rem;
  }
}
</style>
