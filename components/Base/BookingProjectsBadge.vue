<template>
  <span class="booking-projects-badge">
    {{ count }} Projects Booked
  </span>
</template>

<script setup>
const props = defineProps({
  count: { type: Number, default: 0 }
});
</script>

<style scoped>
.booking-projects-badge {
  background-color: #007bff;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}
</style>
