<template>
  <v-container class="py-8">
    <v-alert v-if="error" type="error" class="mb-4" aria-live="assertive">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading" type="card" height="200px" />

    <v-row v-else align="center" justify="center">
      <v-col cols="12" md="6" class="mx-auto">
        <v-card>
          <v-card-text class="text-center">
            <v-avatar size="96" class="mx-auto mb-4">
              <img
                :src="user.avatar_url || 'https://i.pravatar.cc/150?u=default'"
                :alt="`${displayName} avatar`"
                aria-label="User avatar"
              />
            </v-avatar>
            <h2 class="text-h6 font-weight-bold mb-2">{{ displayName }}</h2>
            <div class="mb-2 text-grey font-mono">{{ user.email }}</div>
            <div v-if="user.bio" class="mt-2">{{ user.bio }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabase } from '@/composables/useSupabase'

definePageMeta({ layout: 'user' })

const route = useRoute()
const supabase = useSupabase()
const user = ref<any>({})
const loading = ref(true)
const error = ref('')

const displayName = computed(() => {
  const first = user.value.first_name || ''
  const last = user.value.last_name || ''
  return (first + ' ' + last).trim() || 'Unnamed User'
})

onMounted(async () => {
  loading.value = true
  error.value = ''
  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, avatar_url, bio')
    .eq('id', route.params.id)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else if (data) {
    user.value = data
  }
  loading.value = false
})
</script>
