<template>
  <Contact />
</template>

<script setup>
import Contact from '@/components/Layout/Contact.vue';
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
}
@media (max-width: 900px) {
  .page {
    padding: 1.5rem 0.5rem;
  }
}
@media (max-width: 600px) {
  .page {
    padding: 1rem 0.25rem;
  }
}
</style>
