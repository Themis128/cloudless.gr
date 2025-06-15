<template>
  <v-container class="py-10">
    <h1 class="text-h5 font-weight-bold mb-6">Sitemap</h1>

    <v-list nav dense>
      <v-list-item
        v-for="item in sitemapItems"
        :key="item.link"
        :to="item.link"
        link
        rounded
      >
        <v-list-item-title>{{ item.name }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script setup lang="ts">
interface SitemapItem {
  name: string
  link: string
}

const sitemapItems: SitemapItem[] = [
  { name: 'Home', link: '/' },
  { name: 'About', link: '/about' },
  { name: 'Contact', link: '/contact' },
  { name: 'Projects', link: '/projects' },
  { name: 'Dashboard', link: '/dashboard' },
  { name: 'FAQ', link: '/faq' },
]
</script>

<style scoped>
h1 {
  font-size: 1.8rem;
  color: white;
}
</style>
