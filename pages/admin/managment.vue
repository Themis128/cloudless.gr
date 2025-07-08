<template>
  <div class="admin-management">
    <h1>Admin Management</h1>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <h2>Users</h2>
      <ul>
        <li v-for="user in users" :key="user.id">
          {{ user.email }} <span v-if="user.role">({{ user.role }})</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFetch } from '#app'


interface UsersResponse {
  users: Array<{ id: string; email: string; role?: string }>
}

const users = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    // Replace with your actual admin API endpoint and authentication as needed
    const { data, error: fetchError } = await useFetch<UsersResponse>('/api/admin/users')
    if (fetchError.value) throw new Error(fetchError.value.message)
    users.value = data.value?.users || []
  } catch (err: unknown) {
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'Failed to load users.'
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.admin-management {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.error {
  color: #c00;
  margin-bottom: 1rem;
}
</style>
