<template>
  <nav class="small-nav">
    <button @click="toggleMenu">☰</button>
    <ul v-if="isMenuOpen">
      <li v-for="item in navItems" :key="item.text">
        <a :href="item.link">{{ item.text }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { ref } from 'vue';

const isMenuOpen = ref(false);
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const navItems = [
  { text: 'Home', link: '/' },
  { text: 'Projects', link: '/projects' },
  { text: 'About', link: '/about' },
  { text: 'Contact', link: '/contact' },
];
</script>

<style scoped>
.small-nav {
  background-color: #333;
  padding: 1rem;
}

.small-nav button {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
}

.small-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
  background-color: #444;
}

.small-nav li {
  padding: 0.5rem 1rem;
}

.small-nav a {
  color: white;
  text-decoration: none;
}

.small-nav a:hover {
  text-decoration: underline;
}
</style>
