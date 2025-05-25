<template>
  <footer
    class="w-full py-6 text-gray-800 font-medium text-base bg-transparent mt-auto"
  >
    <div class="container mx-auto px-4">
      <div class="footer-content">
        <div class="footer-left">
          <p>&copy; {{ currentYear }} Cloudless. All rights reserved.</p>
        </div>
        <div class="footer-right">
          <nav class="footer-links">
            <NuxtLink to="/terms" class="footer-link">Terms &amp; Privacy</NuxtLink>
            <NuxtLink to="/faq" class="footer-link">FAQ</NuxtLink>
            <NuxtLink to="/sitemap" class="footer-link">Sitemap</NuxtLink>
            <NuxtLink to="/contact" class="footer-link">Contact</NuxtLink>
            <NuxtLink to="/about" class="footer-link">About</NuxtLink>
          </nav>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const currentYear = computed(() => new Date().getFullYear());
</script>

<style scoped>
footer {
  position: relative;
  bottom: 0;
  width: 100%;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.footer-link {
  color: #4b5563;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #1e40af;
  text-decoration: underline;
}

@media (max-width: 640px) {
  .footer-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .footer-links {
    justify-content: center;
  }
}
</style>
