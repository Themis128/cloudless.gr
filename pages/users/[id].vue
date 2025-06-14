<template>
  <v-container class="py-10">
    <v-row>
      <v-col cols="12" md="6">
        <v-card class="pa-6" elevation="4">
          <v-avatar size="80" class="mb-4">
            <img :src="user.avatar_url || 'https://i.pravatar.cc/150?u=default'" alt="avatar" />
          </v-avatar>
          <h2 class="text-h6 font-weight-bold mb-2">{{ user.first_name }} {{ user.last_name }}</h2>
          <div class="mb-2">Email: <span class="font-mono">{{ user.email }}</span></div>
          <div v-if="user.bio">Bio: {{ user.bio }}</div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabase } from '@/composables/useSupabase'

const route = useRoute()
const user = ref<any>({})
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const id = route.params.id
  const supabase = useSupabase()
  loading.value = true
  error.value = null
  const { data, error: fetchError } = await supabase.from('profiles').select('id, first_name, last_name, email, avatar_url, bio').eq('id', id).single()
  if (fetchError) {
    error.value = fetchError.message
    user.value = {}
  } else {
    user.value = data || {}
  }
  loading.value = false
})
</script>
