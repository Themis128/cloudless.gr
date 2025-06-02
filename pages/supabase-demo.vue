<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h4 mb-4">Supabase Integration Demo</h1>
          <p class="text-body-1 mb-6">
            This page demonstrates how to use Supabase with Nuxt to read and write data.
          </p>
        </v-col>
      </v-row>

      <!-- Add New Instrument Form -->
      <v-row>
        <v-col cols="12" md="6">
          <v-card class="mb-6">
            <v-card-title>Add New Instrument</v-card-title>
            <v-card-text>
              <v-form @submit.prevent="addInstrument">
                <v-text-field
                  v-model="newInstrumentName"
                  label="Instrument Name"
                  required
                  :disabled="loading"
                />
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="loading"
                  :disabled="!newInstrumentName.trim()"
                >
                  Add Instrument
                </v-btn>
              </v-form>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Instruments List -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <span>Instruments List</span>
              <v-btn
                color="secondary"
                variant="outlined"
                @click="refreshInstruments"
                :loading="loading"
              >
                <v-icon left>mdi-refresh</v-icon>
                Refresh
              </v-btn>
            </v-card-title>
            <v-card-text>
              <v-alert
                v-if="error"
                type="error"
                class="mb-4"
                closable
                @click:close="error = ''"
              >
                {{ error }}
              </v-alert>

              <v-alert
                v-if="success"
                type="success"
                class="mb-4"
                closable
                @click:close="success = ''"
              >
                {{ success }}
              </v-alert>

              <div v-if="loading" class="text-center py-4">
                <v-progress-circular indeterminate color="primary" />
                <p class="mt-2">Loading instruments...</p>
              </div>

              <div v-else-if="instruments.length === 0" class="text-center py-4">
                <v-icon size="64" color="grey-lighten-1">mdi-music-note-off</v-icon>
                <p class="text-h6 mt-2">No instruments found</p>
                <p class="text-body-2">Add your first instrument above!</p>
              </div>

              <v-list v-else>
                <v-list-item
                  v-for="instrument in instruments"
                  :key="instrument.id"
                  class="border-b"
                >
                  <template #prepend>
                    <v-icon color="primary">mdi-music</v-icon>
                  </template>

                  <v-list-item-title>{{ instrument.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    ID: {{ instrument.id }} | Created: {{ formatDate(instrument.created_at) }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      color="error"
                      variant="text"
                      @click="deleteInstrument(instrument.id)"
                      :disabled="loading"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Connection Status -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title>Supabase Connection Status</v-card-title>
            <v-card-text>
              <v-chip
                :color="isConnected ? 'success' : 'error'"
                :icon="isConnected ? 'mdi-check-circle' : 'mdi-alert-circle'"
              >
                {{ isConnected ? 'Connected to Supabase' : 'Connection Error' }}
              </v-chip>
              <p class="mt-2 text-body-2">
                <strong>Project URL:</strong> {{ config.public.supabaseUrl }}<br>
                <strong>Using @nuxtjs/supabase module:</strong> {{ hasSupabaseModule ? 'Yes' : 'No' }}
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from '#imports'

// Define page meta
definePageMeta({
  layout: 'default',
  title: 'Supabase Demo'
})

// Set page title
useHead({
  title: 'Supabase Integration Demo - Cloudless'
})

// Get runtime config
const config = useRuntimeConfig()

// Get Supabase client (using @nuxtjs/supabase module)
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Reactive data
const instruments = ref([])
const newInstrumentName = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const isConnected = ref(false)
const hasSupabaseModule = ref(true)

// Methods
const getInstruments = async () => {
  try {
    loading.value = true
    error.value = ''

    const { data, error: supabaseError } = await supabase
      .from('instruments')
      .select('*')
      .order('created_at', { ascending: false })

    if (supabaseError) {
      throw supabaseError
    }

    instruments.value = data || []
    isConnected.value = true
  } catch (err: any) {
    console.error('Error fetching instruments:', err)
    error.value = err.message || 'Failed to fetch instruments'
    isConnected.value = false
  } finally {
    loading.value = false
  }
}

const addInstrument = async () => {
  if (!newInstrumentName.value.trim()) return

  try {
    loading.value = true
    error.value = ''
    success.value = ''

    const { data, error: supabaseError } = await supabase
      .from('instruments')
      .insert([{ name: newInstrumentName.value.trim() }])
      .select()

    if (supabaseError) {
      throw supabaseError
    }

    success.value = `Added "${newInstrumentName.value}" successfully!`
    newInstrumentName.value = ''
    await getInstruments() // Refresh the list
  } catch (err: any) {
    console.error('Error adding instrument:', err)
    error.value = err.message || 'Failed to add instrument'
  } finally {
    loading.value = false
  }
}

const deleteInstrument = async (id: number) => {
  try {
    loading.value = true
    error.value = ''
    success.value = ''

    const { error: supabaseError } = await supabase
      .from('instruments')
      .delete()
      .eq('id', id)

    if (supabaseError) {
      throw supabaseError
    }

    success.value = 'Instrument deleted successfully!'
    await getInstruments() // Refresh the list
  } catch (err: any) {
    console.error('Error deleting instrument:', err)
    error.value = err.message || 'Failed to delete instrument'
  } finally {
    loading.value = false
  }
}

const refreshInstruments = async () => {
  await getInstruments()
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Load instruments on mount
onMounted(async () => {
  await getInstruments()
})
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
