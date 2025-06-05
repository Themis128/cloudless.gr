<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h4 mb-4">Supabase Integration Demo</h1>
          <p class="text-body-1 mb-6">
            This page demonstrates how to use Supabase with Nuxt to read and write data.<br>
            <strong>Debug Info:</strong>
          </p>
          <ul>
            <li><b>SUPABASE_URL:</b> <code>{{ debug.supabaseUrl || 'NOT SET' }}</code></li>
            <li><b>SUPABASE_KEY:</b> <code>{{ debug.supabaseKey ? debug.supabaseKey.slice(0, 6) + '...' : 'NOT SET' }}</code></li>
            <li><b>Client available:</b> <code>{{ debug.isAvailable ? 'YES' : 'NO' }}</code></li>
            <li v-if="debug.error" style="color:red"><b>Error:</b> {{ debug.error }}</li>
          </ul>
        </v-col>
      </v-row>

      <v-row v-if="debug.isAvailable">
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

      <v-row v-if="debug.isAvailable">
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

      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title>Supabase Connection Status</v-card-title>
            <v-card-text>
              <v-chip
                :color="debug.isAvailable ? 'success' : 'error'"
                :icon="debug.isAvailable ? 'mdi-check-circle' : 'mdi-alert-circle'"
              >
                {{ debug.isAvailable ? 'Connected to Supabase' : 'Connection Error' }}
              </v-chip>
              <p class="mt-2 text-body-2">
                <strong>SUPABASE_URL:</strong> {{ debug.supabaseUrl || 'NOT SET' }}<br />
                <strong>SUPABASE_KEY:</strong> {{ debug.supabaseKey ? debug.supabaseKey.slice(0, 6) + '...' : 'NOT SET' }}<br />
                <strong>Client available:</strong> {{ debug.isAvailable ? 'YES' : 'NO' }}<br />
                <span v-if="debug.error" style="color:red"><b>Error:</b> {{ debug.error }}</span>
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

// Debug info
const config = useRuntimeConfig()
const debug = {
  supabaseUrl: config.public.supabaseUrl,
  supabaseKey: config.public.supabaseKey,
  isAvailable: !!(config.public.supabaseUrl && config.public.supabaseKey),
  error: ''
}

const supabase = useSupabaseClient()

// Define types for instruments
interface Instrument {
  id: string
  name: string
  created_at: string
}

// Reactive data
const instruments = ref<Instrument[]>([])
const newInstrumentName = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const getInstruments = async () => {
  if (!debug.isAvailable) {
    error.value = 'Supabase client is not available.'
    debug.error = 'Supabase client is not available.'
    return
  }
  try {
    loading.value = true
    error.value = ''
    const { data, error: supabaseError } = await supabase!.from('instruments').select('*').order('created_at', { ascending: false })
    if (supabaseError) {
      throw supabaseError
    }
    instruments.value = data || []
  } catch (err: any) {
    console.error('Error fetching instruments:', err)
    error.value = err.message || 'Failed to fetch instruments'
    debug.error = err.message || 'Failed to fetch instrumednts'
  } finally {
    loading.value = false
  }
}

const addInstrument = async () => {
  if (!debug.isAvailable) {
    error.value = 'Supabase client is not available.'
    debug.error = 'Supabase client is not available.'
    return
  }
  if (!newInstrumentName.value.trim()) return
  try {
    loading.value = true
    error.value = ''
    success.value = ''
    const { error: supabaseError } = await supabase!.from('instruments').insert([{ name: newInstrumentName.value.trim() }] as any).select()
    if (supabaseError) {
      throw supabaseError
    }
    success.value = `Added "${newInstrumentName.value}" successfully!`
    newInstrumentName.value = ''
    await getInstruments()
  } catch (err: any) {
    console.error('Error adding instrument:', err)
    error.value = err.message || 'Failed to add instrument'
    debug.error = err.message || 'Failed to add instrument'
  } finally {
    loading.value = false
  }
}

const deleteInstrument = async (id: number) => {
  if (!debug.isAvailable) {
    error.value = 'Supabase client is not available.'
    debug.error = 'Supabase client is not available.'
    return
  }
  try {
    loading.value = true
    error.value = ''
    success.value = ''
    const { error: supabaseError } = await supabase!.from('instruments').delete().eq('id', id)
    if (supabaseError) {
      throw supabaseError
    }
    success.value = 'Instrument deleted successfully!'
    await getInstruments()
  } catch (err: any) {
    console.error('Error deleting instrument:', err)
    error.value = err.message || 'Failed to delete instrument'
    debug.error = err.message || 'Failed to delete instrument'
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

onMounted(async () => {
  await getInstruments()
})
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
