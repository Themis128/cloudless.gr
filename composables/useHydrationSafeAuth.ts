import { nextTick, readonly, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/authStore'
import { useRBACStore } from '~/stores/rbacStore'

export const useHydrationSafeAuth = () => {
  const isClient = ref(false)
  const isAuthenticated = ref(false)
  const user = ref<any>(null)
  const authLoading = ref(false)
  const isAdmin = ref(false)

  // Ensure consistent initial state on server and client
  if (process.server) {
    // Server-side: always return false to prevent hydration mismatch
    return {
      isClient: readonly(ref(false)),
      isAuthenticated: readonly(ref(false)),
      user: readonly(ref(null)),
      authLoading: readonly(ref(false)),
      isAdmin: readonly(ref(false)),
    }
  }

  // Initialize only on client side to prevent hydration mismatches
  if (process.client) {
    isClient.value = true

    // Use nextTick with a small delay to ensure DOM is ready and hydration is complete
    nextTick(() => {
      setTimeout(() => {
        const authStore = useAuthStore()
        const rbacStore = useRBACStore()

        // Set initial values
        isAuthenticated.value = authStore.isAuthenticated
        user.value = authStore.user
        authLoading.value = authStore.isLoading
        isAdmin.value = rbacStore.isAdmin

        // Watch for changes
        watch(
          () => ({
            isAuthenticated: authStore.isAuthenticated,
            user: authStore.user,
            isLoading: authStore.isLoading,
            isAdmin: rbacStore.isAdmin,
          }),
          newState => {
            isAuthenticated.value = newState.isAuthenticated
            user.value = newState.user
            authLoading.value = newState.isLoading
            isAdmin.value = newState.isAdmin
          },
          { immediate: true }
        )
      }, 100) // Small delay to ensure hydration is complete
    })
  }

  return {
    isClient: readonly(isClient),
    isAuthenticated: readonly(isAuthenticated),
    user: readonly(user),
    authLoading: readonly(authLoading),
    isAdmin: readonly(isAdmin),
  }
}
