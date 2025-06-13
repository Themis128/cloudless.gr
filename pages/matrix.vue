<template>
  <div class="matrix-page">
    <h1 class="matrix-title">Admins & Users Matrix</h1>
    <div class="matrix-container">
      <div class="matrix-table">
        <h2>Admins</h2>
        <pre class="debug-json">{{ admins }}</pre>
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
        <pre class="debug-json">{{ users }}</pre>
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

const admins = ref<any[]>([])
const users = ref<any[]>([])
const adminColumns = ref<string[]>([])
const userColumns = ref<string[]>([])

onMounted(async () => {
  const res = await fetch('/api/admin-users')
  const data = await res.json()
  admins.value = data.admins || []
  users.value = data.users || []
  adminColumns.value = admins.value.length ? Object.keys(admins.value[0]) : []
  userColumns.value = users.value.length ? Object.keys(users.value[0]) : []
})
</script>

<style scoped>
.matrix-page {
  padding: 2rem;
  min-height: 100vh;
  color: #fff;
}
.matrix-title {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2rem;
  letter-spacing: 2px;
  font-weight: bold;
}
.matrix-container {
  display: flex;
  gap: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}
.matrix-table {
  background: rgba(30, 30, 47, 0.85);
  border-radius: 1rem;
  box-shadow: 0 6px 32px 0 rgba(0,0,0,0.25);
  padding: 1.5rem;
  min-width: 320px;
  max-width: 100%;
  overflow-x: auto;
}
.matrix-table h2 {
  margin-bottom: 1rem;
  text-align: center;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 1px;
}
.v-table {
  background: transparent;
  color: #fff;
}
th, td {
  padding: 0.5rem 1rem;
  text-align: left;
}
th {
  background: rgba(255,255,255,0.08);
  font-weight: 600;
}
tr:nth-child(even) td {
  background: rgba(255,255,255,0.03);
}
.no-data {
  color: #ffb4b4;
  text-align: center;
  margin-top: 1rem;
}
.debug-json {
  font-size: 0.85rem;
  color: #b5e0ff;
  background: rgba(0,0,0,0.12);
  border-radius: 6px;
  padding: 0.5rem;
  margin-bottom: 1rem;
  word-break: break-all;
}
</style>
