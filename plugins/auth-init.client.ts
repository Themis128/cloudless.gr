import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin(async nuxtApp => {
  if (process.client) {
    // Wait for the app to be mounted before initializing auth
    nuxtApp.hook('app:mounted', async () => {
      // Import auth store only on client side
      const { useAuthStore } = await import('~/stores/authStore')
      const authStore = useAuthStore()

      // Initialize auth state to prevent hydration mismatches
      authStore.initializeAuth()

      // Force a small re-render to ensure auth state is properly reflected
      setTimeout(() => {
        // Trigger a resize event to force re-render
        window.dispatchEvent(new Event('resize'))
      }, 100)
    })
  }
})
