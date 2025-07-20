<template>
  <div>
    <BotGuide />
    <v-container>
      <h1 class="mb-4">
        <v-icon size="32" class="mr-3">
          mdi-robot
        </v-icon>
        Bot Details
      </h1>
      
      <v-card>
        <v-card-title class="text-h6">
          Edit Bot
        </v-card-title>
        <v-card-text>
          <v-form class="edit-form" @submit.prevent="updateBot">
            <v-text-field
              v-model="form.botName"
              label="Bot Name"
              class="form-field"
              required
            />
            <v-textarea
              v-model="form.description"
              label="Description"
              class="form-field"
              rows="3"
            />
            <v-select
              v-model="form.modelType"
              :items="modelTypes"
              label="Model Type"
              class="form-field"
              required
            />
            <v-text-field
              v-model="form.apiKey"
              label="API Key"
              type="password"
              class="form-field"
              required
            />
            <v-textarea
              v-model="form.systemPrompt"
              label="System Prompt"
              class="form-field"
              rows="4"
              required
            />
            <v-select
              v-model="form.status"
              :items="statusOptions"
              label="Status"
              class="form-field"
              required
            />
            
            <div class="form-actions">
              <v-btn
                type="submit"
                color="primary"
                :loading="loading"
                size="large"
              >
                <v-icon start>
                  mdi-content-save
                </v-icon>
                Update Bot
              </v-btn>
              <v-btn
                text
                class="ml-2"
                size="large"
                @click="resetForm"
              >
                <v-icon start>
                  mdi-refresh
                </v-icon>
                Reset
              </v-btn>
              <v-btn
                color="error"
                text
                class="ml-2"
                size="large"
                @click="deleteBot"
              >
                <v-icon start>
                  mdi-delete
                </v-icon>
                Delete Bot
              </v-btn>
            </div>
          </v-form>
          
          <v-alert v-if="success" type="success" class="mt-4">
            <v-icon start>
              mdi-check-circle
            </v-icon>
            Bot updated successfully!
          </v-alert>
          <v-alert v-if="error" type="error" class="mt-4">
            <v-icon start>
              mdi-alert-circle
            </v-icon>
            {{ error }}
          </v-alert>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BotGuide from '~/components/step-guides/BotGuide.vue'
import { useSupabase } from '~/composables/supabase'

const route = useRoute()
const router = useRouter()
const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const botId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id

const modelTypes = [
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku'
]

const statusOptions = ['active', 'inactive', 'maintenance']

const form = ref({
  botName: '',
  description: '',
  modelType: '',
  apiKey: '',
  systemPrompt: '',
  status: 'active',
})

const resetForm = () => {
  success.value = false
  error.value = null
}

const loadBot = async () => {
  try {
    const { data, error: err } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()
    
    if (err) {
      error.value = err.message
    } else if (data) {
      form.value = {
        botName: data.name || '',
        description: data.description || '',
        modelType: data.model_type || '',
        apiKey: data.api_key || '',
        systemPrompt: data.system_prompt || '',
        status: data.status || 'active',
      }
    }
  } catch (err) {
    error.value = 'Failed to load bot details'
  }
}

const updateBot = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const { error: err } = await supabase
      .from('bots')
      .update({
        name: form.value.botName,
        description: form.value.description,
        model_type: form.value.modelType,
        api_key: form.value.apiKey,
        system_prompt: form.value.systemPrompt,
        status: form.value.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', botId)
    
    if (err) {
      error.value = err.message
    } else {
      success.value = true
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

const deleteBot = async () => {
  if (confirm('Are you sure you want to delete this bot?')) {
    try {
      const { error: err } = await supabase
        .from('bots')
        .delete()
        .eq('id', botId)
      
      if (err) {
        error.value = err.message
      } else {
        router.push('/bots')
      }
    } catch (err) {
      error.value = 'Failed to delete bot'
    }
  }
}

onMounted(() => {
  loadBot()
})
</script>

<style scoped>
.edit-form {
  margin-bottom: 2rem;
}

.form-field {
  margin-bottom: 1.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .v-btn {
    width: 100%;
  }
}
</style>
