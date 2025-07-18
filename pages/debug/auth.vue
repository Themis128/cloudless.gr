<template>
  <div>
    <BackButton to="/debug" />
    <v-card>
      <v-card-title>Auth Debug</v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item>
            <v-list-item-title>User ID</v-list-item-title>
            <v-list-item-subtitle>{{ authState.user?.id || 'Not logged in' }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Email</v-list-item-title>
            <v-list-item-subtitle>{{ authState.user?.email || 'N/A' }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Session</v-list-item-title>
            <v-list-item-subtitle>{{ authState.session ? 'Active' : 'None' }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import BackButton from '~/components/ui/BackButton.vue'
import type { User, Session } from '@supabase/supabase-js'

const supabase = useSupabase()
const authState = ref<{ user: User | null; session: Session | null }>({
  user: null,
  session: null
})

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    authState.value.session = data.session
    authState.value.user = data.session.user
  }
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
