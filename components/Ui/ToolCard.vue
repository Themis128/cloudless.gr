<template>
  <div class="tool-card">
    <h3>{{ toolName }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  toolName: {
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
.tool-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 0.5rem;
}
</style>
