<template>
  <nav class="flex md:hidden gap-2 items-center">
    <NuxtLink
      v-for="link in links"
      :key="link.path"
      :to="link.path"
      class="nav-link"
      exact-active-class="active-link"
      :aria-current="$route.path === link.path ? 'page' : undefined"
    >
      {{ link.name.charAt(0).toUpperCase() + link.name.slice(1) }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const links = ref<{ name: string; path: string }[]>([])
const EXCLUDED_ROUTES = [
  '/admin', '/admin/login', '/admin/dashboard',
  '/auth', '/auth/login', '/auth/register', '/auth/reset'
]

onMounted(() => {
  const router = useRouter()
  links.value = router.getRoutes()
    .filter(r =>
      r.path &&
      !EXCLUDED_ROUTES.includes(r.path) &&
      !r.path.includes(':') &&
      r.path.split('/').length <= 2
    )
    .map(r => ({
      name: r.name
        ? String(r.name)
        : (r.path === '/' ? 'Home' : r.path.replace('/', '')),
      path: r.path
    }))
})
</script>

<style scoped>
.nav-link {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  color: #374151;
  font-weight: 500;
  transition: background 0.2s;
  font-size: 0.95rem;
  text-decoration: none;
  outline: none;
}
.nav-link:hover, .nav-link:focus {
  background: #e0e7ff;
  color: #3730a3;
}
.active-link {
  background: #e0e7ff;
  color: #1e3a8a;
  font-weight: 600;
}
</style>
