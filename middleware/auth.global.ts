import { useSupabase } from '~/composables/useSupabase'
import { withoutTrailingSlash } from 'ufo'

// Define public routes that do **not** require authentication
const publicRoutes = [
  '/',
  '/info',
  '/info/matrix',
  '/info/about',
  '/info/contact',
  '/info/faq',
  '/info/sitemap',
  '/auth',
  '/auth/register',
  '/auth/reset',
  '/auth/admin-login'
]

export default defineNuxtRouteMiddleware(async (to) => {
  const normalizedPath = withoutTrailingSlash(to.path || '/')

  // If the requested path is a public route, allow access without authentication
  if (publicRoutes.includes(normalizedPath)) {
    return // Public access allowed
  }

  // Otherwise, check if the user is authenticated
  const supabase = useSupabase()
  const { data, error } = await supabase.auth.getSession()

  // Handle case where there's no session or there's an error
  if (error || !data.session?.user) {
    // Save the intended route in the redirect query param
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
