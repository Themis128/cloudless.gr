<template>
  <div class="about-text">
    <p>{{ text }}</p>
  </div>
</template>

<script setup>
const { text } = defineProps({
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
  padding: 1rem;
  border-radius: 0.5rem;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  max-width: 100%;
  word-break: break-word;
  margin: 0 auto;
}
@media (max-width: 600px) {
  .about-text {
    font-size: 0.95rem;
    padding: 0.75rem;
  }
}
</style>
