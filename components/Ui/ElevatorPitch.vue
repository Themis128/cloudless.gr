<template>
  <div class="elevator-pitch">
    <p>{{ pitch }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  pitch: {
    type: String,
    default: 'Quickly explain your value proposition here.'
  }
});
</script>

<style scoped>
.elevator-pitch {
  font-size: 1.2rem;
  color: #555;
}
</style>
