<template>
  <div>
    <h1>{{ pageTitle }}</h1>
    <p>This is a dynamic project page for the slug: {{ slug }}</p>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
const slug = route.params.slug;
const pageTitle = `Project: ${slug}`;
</script>

<script>
export default {
  layout: 'default',
};
</script>

<style scoped>
h1 {
  color: #1e40af; /* Tailwind primary color */
}
</style>
