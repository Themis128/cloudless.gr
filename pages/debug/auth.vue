<template>
  <div>
    <v-container>
      <!-- Back to Debug Button -->
      <div class="mb-4">
        <v-btn
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-arrow-left"
          @click="goBackToDebug"
        >
          Back to Debug
        </v-btn>
      </div>
      
      <h1 class="mb-4">
        Auth Debug
      </h1>
      <v-form @submit.prevent="testAuth">
        <v-text-field
          v-model="form.email"
          label="Email"
          type="email"
          class="mb-3"
          required
        />
        <v-text-field
          v-model="form.password"
          label="Password"
          type="password"
          class="mb-3"
          required
        />
        <v-btn type="submit" color="primary" :loading="loading">
          Test Authentication
        </v-btn>
        <v-btn text class="ml-2" @click="resetForm">
          Reset
        </v-btn>
        <v-btn
          color="secondary"
          text
          class="ml-2"
          @click="checkCurrentAuth"
        >
          Check Current Auth
        </v-btn>
      </v-form>
      <v-alert v-if="success" type="success" class="mt-4">
        Authentication test completed successfully!
      </v-alert>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
      <v-card v-if="authInfo" class="mt-4">
        <v-card-title>Current Auth Status</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>User ID</v-list-item-title>
              <v-list-item-subtitle>{{ authInfo.user?.id || 'Not logged in' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Email</v-list-item-title>
              <v-list-item-subtitle>{{ authInfo.user?.email || 'N/A' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Session</v-list-item-title>
              <v-list-item-subtitle>{{ authInfo.session ? 'Active' : 'None' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import type { Session, User } from '@supabase/supabase-js'
import { onMounted, ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const authInfo = ref<{ user: User | null; session: Session | null } | null>(null)

const form = ref({
  email: '',
  password: '',
})

const resetForm = () => {
  form.value = {
    email: '',
    password: '',
  }
  success.value = false
  error.value = null
}

const testAuth = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })
    
    if (authError) {
      error.value = authError.message
    } else {
      success.value = true
      authInfo.value = {
        user: data.user,
        session: data.session,
      }
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

const checkCurrentAuth = async () => {
  try {
    const { data } = await supabase.auth.getSession()
    authInfo.value = {
      user: data.session?.user || null,
      session: data.session,
    }
  } catch (err) {
    error.value = 'Failed to check current authentication'
  }
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}

onMounted(() => {
  checkCurrentAuth()
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
