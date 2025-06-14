<template>
  <div class="matrix-page">
    <h1 class="matrix-title">Admins & Users Matrix</h1>
    <v-progress-linear indeterminate v-if="loading" />
    <div class="matrix-container" v-else>
      <div class="matrix-table">
        <h2>Admins</h2>
        <v-table dense v-if="adminColumns.length">
          <thead>
            <tr>
              <th v-for="col in adminColumns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="admin in admins" :key="admin.id">
              <td v-for="col in adminColumns" :key="col">{{ admin[col] }}</td>
            </tr>
          </tbody>
        </v-table>
        <div v-else class="no-data">No admins found.</div>
      </div>
      <div class="matrix-table">
        <h2>Users</h2>
        <v-table dense v-if="userColumns.length">
          <thead>
            <tr>
              <th v-for="col in userColumns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td v-for="col in userColumns" :key="col">{{ user[col] }}</td>
            </tr>
          </tbody>
        </v-table>
        <div v-else class="no-data">No users found.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  title: 'Admin/User Matrix',
  description: 'View all registered admins and users in tabular format.'
})

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  is_admin: boolean
  [key: string]: any
}

const admins = ref<UserProfile[]>([])
const users = ref<UserProfile[]>([])
const adminColumns = ref<string[]>([])
const userColumns = ref<string[]>([])
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch('/api/admin-users')
    const data = await res.json()
    admins.value = data.admins || []
    users.value = data.users || []
    adminColumns.value = admins.value.length ? Object.keys(admins.value[0]) : []
    userColumns.value = users.value.length ? Object.keys(users.value[0]) : []
  } catch (err) {
    console.error('Failed to fetch matrix:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.matrix-container {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  justify-content: space-around;
}

.matrix-table {
  flex: 1;
  min-width: 300px;
  max-width: 100%;
  overflow-x: auto;
}
</style>
