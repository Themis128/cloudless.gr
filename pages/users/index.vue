<template>
  <v-container class="py-10">
    <h1 class="text-h5 font-weight-bold mb-6">All Users</h1>
    <v-table>
      <thead>
        <tr>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Email</th>
          <th>Profile</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.first_name }}</td>
          <td>{{ user.last_name }}</td>
          <td>{{ user.email }}</td>
          <td>
            <NuxtLink :to="`/users/${user.id}`">
              <v-btn size="small" color="primary" variant="outlined">View</v-btn>
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '@/composables/useSupabase'

const users = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const supabase = useSupabase()
  loading.value = true
  error.value = null
  const { data, error: fetchError } = await supabase.from('profiles').select('id, first_name, last_name, email')
  if (fetchError) {
    error.value = fetchError.message
    users.value = []
  } else {
    users.value = data || []
  }
  loading.value = false
})
</script>
