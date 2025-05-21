<template>
  <nav class="large-nav">
    <ul class="items-center">
      <li v-for="item in navItems" :key="item.text">
        <a :href="item.link">{{ item.text }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup>
const navItems = [
  { text: 'Home', link: '/' },
  { text: 'Projects', link: '/projects' },
  { text: 'About', link: '/about' },
  { text: 'Contact', link: '/contact' },
  { text: 'Codegen', link: '/codegen' },
];
</script>

<style scoped>
.large-nav {
  display: flex;
  justify-content: space-around;
  background: transparent !important;
  padding: 1rem;
  z-index: 1002 !important;
  position: relative;
}

.large-nav ul {
  list-style: none;
  display: flex;
  gap: 1rem;
  background: transparent !important;
}

.large-nav a {
  color: #fff !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  text-decoration: none;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  transition: color 0.2s;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  opacity: 1 !important;
  filter: none !important;
}

.large-nav a:hover {
  text-decoration: underline;
  color: #60a5fa !important; /* Tailwind's blue-400 for hover */
}

.large-nav,
.large-nav ul {
  background: transparent !important;
  box-shadow: none !important;
}

.large-nav li {
  opacity: 1 !important;
  filter: none !important;
}

.text-blue-600 {
  color: #2563eb !important; /* Tailwind's blue-600 */
}

.logo-link {
  color: #fff !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: color 0.2s;
}

.logo-link:hover,
.logo-link:focus {
  color: #60a5fa !important; /* Tailwind's blue-400 for hover */
}

.logo-link,
.text-indigo-700 {
  color: #fff !important;
}
</style>
