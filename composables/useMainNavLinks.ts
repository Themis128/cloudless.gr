// composables/useMainNavLinks.ts
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const EXCLUDED_ROUTES = [
    '/admin', '/admin/login', '/admin/dashboard',
    '/auth', '/auth/login', '/auth/register', '/auth/reset'
]

export function useMainNavLinks() {
    const router = useRouter()
    // Only include top-level, non-admin/auth, non-dynamic routes
    const links = computed(() => {
        if (import.meta.server) return [] // SSR-safe
        return router.getRoutes()
            .filter(r =>
                r.path &&
                !EXCLUDED_ROUTES.includes(r.path) &&
                !r.path.includes(':') &&
                r.path.split('/').length <= 2 // Only top-level
            )
            .map(r => ({
                name: r.name ?? r.path.replace('/', '') ?? 'Home',
                path: r.path
            }))
    })
    return { links }
}
