<template>
  <div class="about-page">
    <div class="about-card">
      <h1>About Us</h1>
      <p>Welcome to our website! Learn more about us here.</p>
    </div>
  </div>
</template>

<script setup>
// Add any necessary logic here
</script>

<style scoped>
.about-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg, #f8fafc);
  padding: 2rem;
}

.about-card {
  background: var(--color-card, #fff);
  border-radius: 1.25rem;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.07);
  padding: 2.5rem 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  transition: box-shadow 0.2s;
}

.about-card:focus-within, .about-card:hover {
  box-shadow: 0 8px 32px 0 rgba(0,0,0,0.12);
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-primary, #222);
}

p {
  font-size: 1.1rem;
  color: var(--color-text, #555);
}

:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}
</style>
