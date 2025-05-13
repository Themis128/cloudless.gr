<template>
  <div class="project-card">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.project-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 0.5rem;
}
</style>
