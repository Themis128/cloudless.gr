<template>
  <div class="about-text">
    <p>{{ props.text }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  text: {
    type: String,
    default: 'This is a reusable component for displaying about text.'
  }
});
</script>

<style scoped>
.about-text {
  font-size: 1rem;
  color: #333;
}
</style>
