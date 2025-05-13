<template>
  <div class="flex flex-col justify-center">
    <LayoutHero />
    <LayoutPortfolio />
    <LayoutAbout />
    <LayoutServices />
    <LayoutContact />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'IndexPage'
});
import { useHead, useSeoMeta } from 'nuxt/app';

useHead({ title: 'Full Stack Web Developer' });

useSeoMeta({
  description: 'A showcase of projects by Austin Ewell at AuEwellify, a full-stack developer specializing in front-end excellence.',
  ogTitle: 'Austin Ewell - AuEwellify',
  ogDescription: 'Explore development by Austin Ewell at AuEwellify, a full-stack developer specializing in front-end excellence.',
  ogImage: 'https://i.postimg.cc/gkXvpDLb/portfolio-hero-dark.png',
  ogUrl: 'https://auewellify.dev/',
  twitterTitle: 'Austin Ewell - AuEwellify',
  twitterDescription: 'A showcase of projects by Austin Ewell at AuEwellify, a full-stack developer specializing in front-end excellence.',
  twitterImage: 'https://i.postimg.cc/gkXvpDLb/portfolio-hero-dark.png'
});
</script>

<style scoped>
/* Add styles specific to this page */
h1 {
  color: #1E40AF; /* Tailwind primary color */
}
</style>
