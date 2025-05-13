<template>
  <div class="service-card-page">
    <div class="service-card">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
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
.service-card-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg, #f8fafc);
  padding: 2rem;
}

.service-card {
  background: var(--color-card, #fff);
  border-radius: 1.25rem;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.07);
  padding: 2.5rem 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  transition: box-shadow 0.2s;
}

.service-card:focus-within, .service-card:hover {
  box-shadow: 0 8px 32px 0 rgba(0,0,0,0.12);
}

h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-primary, #222);
}

p {
  font-size: 1.1rem;
  color: var(--color-text, #555);
  margin-bottom: 0.5rem;
}

:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}
</style>
