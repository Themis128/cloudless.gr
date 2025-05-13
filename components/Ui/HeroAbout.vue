<template>
  <div class="hero-about">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: 'About Our Mission'
  },
  description: {
    type: String,
    default: 'We strive to make a difference.'
  }
});
</script>

<style scoped>
.hero-about {
  text-align: center;
  padding: 2rem;
}
</style>
