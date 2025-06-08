<template>
  <div class="dashboard-page px-4 py-6">
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card elevation="4" class="pa-4">
            <v-row align="center" justify="space-between">
              <v-col>
                <h1 class="text-h5 font-weight-bold">Welcome, {{ user?.email }}</h1>
                <p class="text-body-2 text-medium-emphasis">
                  Your user ID is <strong>{{ user?.id }}</strong>
                </p>
              </v-col>
              <v-col class="text-end">
                <v-btn color="error" variant="tonal" @click="logout" prepend-icon="mdi-logout">
                  Logout
                </v-btn>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-6">
        <v-col cols="12" md="6">
          <v-card class="pa-4" elevation="2">
            <h2 class="text-h6 mb-2">Your Account Details</h2>
            <p class="text-body-2">Email: {{ user?.email }}</p>
            <p class="text-body-2">Role: {{ user?.role || 'N/A' }}</p>
            <p class="text-body-2">Confirmed at: {{ user?.confirmed_at || 'Pending' }}</p>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['02.auth-unified.global'], // Ensures session check on server side
})

const supabase = useSupabaseClient()
const router = useRouter()

const { data: userData } = await useFetch('/api/auth/session', {
  credentials: 'include',
})

const user = ref(userData.value?.user)

if (!user.value) {
  await router.push('/auth/login?redirect=/dashboard')
}

const logout = async () => {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await router.push('/auth/login')
  } catch (e) {
    console.error('Logout failed:', e)
  }
}
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background-color: var(--v-theme-background);
  color: var(--v-theme-on-background);
}
</style>
