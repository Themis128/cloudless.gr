<template>
  <nav class="large-nav">
    <ul>
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
];
</script>

<style scoped>
.large-nav {
  display: flex;
  justify-content: space-around;
  background-color: #333;
  padding: 1rem;
}

.large-nav ul {
  list-style: none;
  display: flex;
  gap: 1rem;
}

.large-nav a {
  color: white;
  text-decoration: none;
  font-size: 1.2rem;
}

.large-nav a:hover {
  text-decoration: underline;
}
</style>
