<template>
  <section class="p-4 space-y-6">
    <DebugInspector :data="authState" title="Auth State" />
    <DebugLogsViewer :logs="authLogs" />
  </section>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import DebugInspector from '~/components/debug/DebugInspector.vue'
import DebugLogsViewer from '~/components/debug/DebugLogsViewer.vue'

import type { Session, User } from '@supabase/auth-js'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()

const authState = ref<{ user: User | null; session: Session | null }>({
  user: null,
  session: null
})

const authLogs = ref<string[]>(['Fetching auth status...'])

onMounted(async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    authLogs.value.push(`Error fetching session: ${error.message}`)
  } else {
    authState.value.session = data.session
    authState.value.user = data.session?.user || null
    authLogs.value.push('Auth state loaded.')
  }
})
</script>
