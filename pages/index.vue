<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" md="8" lg="4">
        <v-card class="pa-4">
          <h1>Welcome to cloudless.gr</h1>
          <p>Nuxt 3 + Vuetify + Supabase starter</p>
          <v-btn @click="testAuth">Test Supabase Auth</v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
console.log('🔍 Supabase URL:', config.public.SUPABASE_URL)
console.log('🔐 Supabase Key:', config.public.SUPABASE_ANON_KEY)

const { getUser } = useSupabaseAuth()

const testAuth = async () => {
  const user = await getUser()
  console.log('Logged in user:', user)
}
</script>
