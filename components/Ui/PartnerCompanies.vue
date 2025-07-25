<template>
  <div class="partner-companies-page">
    <div class="partner-companies-card">
      <h3>Our Partners</h3>
      <ul>
        <li v-for="company in companies" :key="company.name">{{ company.name }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  companies: {
    type: Array,
    default: () => [],
  },
});
</script>

<style scoped>
.partner-companies-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg, #f8fafc);
  padding: 2rem;
}

.partner-companies-card {
  background: var(--color-card, #fff);
  border-radius: 1.25rem;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.07);
  padding: 2.5rem 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  transition: box-shadow 0.2s;
}

.partner-companies-card:focus-within,
.partner-companies-card:hover {
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.12);
}

h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-primary, #222);
}

ul {
  list-style: none;
  padding: 0;
}

li {
  font-size: 1.1rem;
  color: var(--color-text, #555);
  margin-bottom: 0.5rem;
}

:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}
</style>
