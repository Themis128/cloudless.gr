// middleware/redirect-after-login.ts
import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { useUserSession } from '~/composables/useUserSession'

export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, isAdmin } = useUserSession()
  if (!loggedIn.value) return
  return isAdmin.value
    ? navigateTo('/admin/dashboard')
    : navigateTo('/user/home')
})
