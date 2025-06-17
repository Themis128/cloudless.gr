<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12">
        <h1 class="text-h5 font-weight-bold mb-6 text-white">Admins & Users Matrix</h1>
        <v-progress-linear v-if="loading" indeterminate color="primary" />

        <v-row
          v-else
          dense
          class="matrix-content"
          align="stretch"
        >
          <v-col cols="12" md="6">
            <v-card class="glass-modern-card">
              <v-card-title class="text-white font-weight-bold">Admins</v-card-title>
              <v-divider class="mb-2" />
              <v-card-text>
                <v-table v-if="adminColumns.length" dense>
                  <thead>
                    <tr>
                      <th v-for="col in adminColumns" :key="col" scope="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="admin in admins" :key="admin.id">
                      <td v-for="col in adminColumns" :key="col">{{ admin[col] }}</td>
                    </tr>
                  </tbody>
                </v-table>
                <div v-else class="no-data">No admins found.</div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card class="glass-modern-card">
              <v-card-title class="text-white font-weight-bold">Users</v-card-title>
              <v-divider class="mb-2" />
              <v-card-text>
                <v-table v-if="userColumns.length" dense>
                  <thead>
                    <tr>
                      <th v-for="col in userColumns" :key="col" scope="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in users" :key="user.id">
                      <td v-for="col in userColumns" :key="col">{{ user[col] }}</td>
                    </tr>
                  </tbody>
                </v-table>
                <div v-else class="no-data">No users found.</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'default',
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
.glass-modern-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  color: white;
  position: relative;
  z-index: 10; /* Ensures card is above other elements */
}

.no-data {
  padding-top: 1rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

th, td {
  color: white;
  font-size: 0.9rem;
  padding: 6px 12px;
}

.matrix-content {
  gap: 1rem;
}

.v-table th {
  background-color: rgba(0, 0, 0, 0.2); /* Slight background to table headers for contrast */
}

.v-table td {
  background-color: rgba(0, 0, 0, 0.1); /* Slight background to table cells for contrast */
}
</style>
