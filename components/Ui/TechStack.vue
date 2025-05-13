<template>
  <div class="tech-stack-page">
    <div class="tech-stack-card">
      <h3>Our Tech Stack</h3>
      <ul>
        <li v-for="tech in techStack" :key="tech">{{ tech }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  techStack: {
    type: Array,
    default: () => []
  }
});
</script>

<style scoped>
.tech-stack-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg, #f8fafc);
  padding: 2rem;
}

.tech-stack-card {
  background: var(--color-card, #fff);
  border-radius: 1.25rem;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.07);
  padding: 2.5rem 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  transition: box-shadow 0.2s;
}

.tech-stack-card:focus-within, .tech-stack-card:hover {
  box-shadow: 0 8px 32px 0 rgba(0,0,0,0.12);
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
