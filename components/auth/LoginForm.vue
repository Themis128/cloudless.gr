
<template>
  <div class="glass-card pa-8 ma-4">
    <client-only>
      <Auth
        :supabase-client="supabaseClient"
        :appearance="{ theme: ThemeSupa, brand: 'inherit' }"
        :providers="['google', 'facebook', 'twitter']"
        :localization="{
          variables: {
            sign_in: {
              email_label: 'Your email address',
              password_label: 'Your strong password'
            }
          }
        }"
        @success="handleAuthSuccess"
      />
    </client-only>
  </div>
</template>

<script setup lang="ts">
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Auth } from '@supa-kit/auth-ui-vue'
import { useSupabaseClient, useRoute, navigateTo } from '#imports'

const supabaseClient = useSupabaseClient()
const route = useRoute()

async function handleAuthSuccess() {
  // Example: fetch user and redirect based on role
  const { data, error } = await supabaseClient.auth.getUser()
  if (error || !data?.user) {
    // fallback if user not found
    return navigateTo('/dashboard')
  }
  // You may store roles in user.user_metadata.role or in a profile table
  const role = data.user.user_metadata?.role
  // If you use a profile table, fetch it here instead
  // const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', data.user.id).single()
  // const role = profile?.role

  // Check for ?redirect=... in query param (always takes precedence)
  if (typeof route.query.redirect === 'string') {
    return navigateTo(route.query.redirect)
  }

  // Role-based redirection (admin and user only)
  if (role === 'admin') {
    return navigateTo('/admin')
  } else {
    // All other roles (including 'user' and unknown) go to /users
    return navigateTo('/users')
  }
}
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.3);
  max-width: 400px;
  width: 100%;
}
@media (max-width: 480px) {
  .glass-card {
    margin: 0;
    border-radius: 12px;
    max-width: 100%;
  }
}
</style>
