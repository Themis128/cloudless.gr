// composables/useMainNavLinks.ts
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const EXCLUDED_ROUTES = [
    '/admin', '/admin/login', '/admin/dashboard',
    '/auth', '/auth/login', '/auth/register', '/auth/reset'
]

export function useMainNavLinks() {
  const router = useRouter();
  // Only include top-level, non-admin/auth, non-dynamic routes
  const links = computed<{ name: string; path: string }[]>(() => {
    // SSR-safe: router.getRoutes() is only available client-side
    if (typeof window === 'undefined' || import.meta.server) return [];
    return router.getRoutes()
      .filter(r =>
        typeof r.path === 'string' &&
        !EXCLUDED_ROUTES.includes(r.path) &&
        !r.path.includes(':') &&
        r.path.split('/').length <= 2 // Only top-level
      )
      .map(r => ({
        name: typeof r.name === 'string' && r.name.length > 0
          ? r.name
          : (r.path.replace('/', '') || 'Home'),
        path: r.path
      }));
  });
  return { links };
}
