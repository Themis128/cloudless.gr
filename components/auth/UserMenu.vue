<template>
  <v-menu offset-y>
    <template #activator="{ props }">
      <v-btn icon v-bind="props" aria-label="Open user menu">
        <v-icon>mdi-account-circle</v-icon>
      </v-btn>
    </template>

    <v-list>
      <v-list-item
        v-for="item in menuItems"
        :key="item.to"
        link
        @click="navigate(item.to)"
      >
        <v-list-item-title>{{ item.title }}</v-list-item-title>
      </v-list-item>

      <v-divider />

      <v-list-item link @click="logout">
        <v-list-item-title class="text-error">Logout</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { getSupabaseClient } from '@/composables/useSupabase'

const router = useRouter()
const supabase = getSupabaseClient()

const menuItems = [
  { title: 'Profile', to: '/users/profile' },
  { title: 'Projects', to: '/users/projects' },
  { title: 'Settings', to: '/users/settings' },
  { title: 'About', to: '/users/about' },
  { title: 'Contact', to: '/users/contact' },
]

function navigate(path: string) {
  router.push(path)
}

async function logout() {
  const { error } = await supabase.auth.signOut()
  if (!error) {
    router.push('/auth')
  } else {
    console.error('Logout failed:', error.message)
  }
}
</script>

<style scoped>
.v-list-item {
  cursor: pointer;
}
</style>
