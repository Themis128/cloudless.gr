<template>
  <v-app-bar app color="primary" dark>
    <v-toolbar-title>Cloudless</v-toolbar-title>
    <v-spacer />

    <template v-for="link in navLinks" :key="link.path">
      <NuxtLink :to="link.path" custom>
        <template #default="{ navigate, href, isExactActive }">
          <v-btn
            :href="href"
            :class="{ 'v-btn--active': isExactActive }"
            text
            @click.prevent="navigate"
          >
            {{ link.name }}
          </v-btn>
        </template>
      </NuxtLink>
    </template>

    <v-btn text @click="logout">Logout</v-btn>
  </v-app-bar>
</template>

<script setup lang="ts">
import { getSupabaseClient } from '@/composables/useSupabase'
import { navigateTo } from '#app'

const supabase = getSupabaseClient()

const navLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Projects', path: '/projects' },
  { name: 'Settings', path: '/settings' },
]

async function logout() {
  await supabase.auth.signOut()
  navigateTo('/auth')
}
</script>

<style scoped>
.v-btn--active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: bold;
}
</style>
