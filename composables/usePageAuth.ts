/**
 * Page-level authentication guard for SPA mode
 * This runs on each protected page to ensure auth before rendering
 */

import { ref } from 'vue'


// Disabled: No authentication enforced. All pages are public.
export const usePageAuth = () => {
  return {
    isAuthenticated: ref(true),
    isAdmin: ref(false),
    user: ref(null),
    loading: ref(false),
    error: ref(''),
    checkAuth: async () => true,
    redirectToAuth: () => {}
  }
}
