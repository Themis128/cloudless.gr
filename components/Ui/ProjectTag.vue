<template>  <span class="project-tag">
    {{ props.tag }}
  </span>
</template>

<script setup>
const props = defineProps({
  tag: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.project-tag {
  background-color: #007bff;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.9rem;
}
</style>
