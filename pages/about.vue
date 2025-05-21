<template>
  <div>
    <div class="about-section">
      <AboutText />
    </div>
  </div>
</template>

<script setup>
import AboutText from '~/components/Ui/AboutText.vue';
</script>

<script>
export default {
  layout: 'default',
};
</script>

<style scoped>
.about-section {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
}
@media (max-width: 900px) {
  .about-section {
    padding: 1.5rem 0.5rem;
  }
}
@media (max-width: 600px) {
  .about-section {
    padding: 1rem 0.25rem;
  }
}
</style>
