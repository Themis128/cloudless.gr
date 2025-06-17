<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="pa-6" elevation="6">
          <v-card-title class="text-h5 font-weight-bold mb-4">User Profile</v-card-title>
          <v-card-text>
            <v-avatar size="96" class="mb-4">
              <img :src="user.avatar_url || 'https://i.pravatar.cc/150?u=default'" :alt="userDisplayName + ' avatar'">
            </v-avatar>
            <div class="mb-2 text-h6">{{ userDisplayName }}</div>
            <div class="mb-2 text-grey font-mono">{{ user.email }}</div>
            <div v-if="user.bio" class="mt-2">{{ user.bio }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

definePageMeta({ layout: 'user' })

const user = ref<any>({})
const userStore = useUserStore()

const userDisplayName = computed(() => {
  const first = user.value.first_name || ''
  const last = user.value.last_name || ''
  return (first + ' ' + last).trim() || 'Unnamed User'
})

onMounted(async () => {
  await userStore.fetchUserProfile()
  user.value = userStore.user
})
</script>

<style scoped>
.text-h6 {
  font-weight: 600;
}
</style>
