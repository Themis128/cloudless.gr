// composables/useUserSession.ts
import { useState, computed } from '#imports'

export interface User {
  id: number | string
  name: string
  email: string
  role: string // 'admin' | 'user' | ...
}

export const useUserSession = () => {
  const user = useState<User | null>('user', () => null)
  const loggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  return {
    user,
    loggedIn,
    isAdmin,
  }
}
