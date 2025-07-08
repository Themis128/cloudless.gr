
// All pages are now public. This middleware is intentionally left empty.
import { defineNuxtRouteMiddleware } from 'nuxt/app'

export default defineNuxtRouteMiddleware(() => {
  // No authentication or user checks. All routes are public.
})
