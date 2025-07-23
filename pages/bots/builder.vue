<template>
  <div>
    <BotGuide />
    <v-container>
      <h1 class="mb-4">
        <v-icon size="32" class="mr-3">
          mdi-robot
        </v-icon>
        Bot Builder
      </h1>
      
      <v-card>
        <v-card-title class="text-h6">
          Bot Details
        </v-card-title>
        <v-card-text>
          <v-form class="create-form" @submit.prevent="createBot">
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
            
            <div class="form-actions">
              <v-btn
                type="submit"
                color="primary"
                :loading="loading"
                size="large"
              >
                <v-icon start>
                  mdi-plus
                </v-icon>
                Create Bot
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
            </div>
          </v-form>
          
          <v-alert v-if="success" type="success" class="mt-4">
            <v-icon start>
              mdi-check-circle
            </v-icon>
            Bot created successfully!
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
import { ref } from 'vue'
import BotGuide from '~/components/step-guides/BotGuide.vue'

interface Bot {
  name: string
  description?: string
  config: string
  status: string
}

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const modelTypes = [
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku'
]

const form = ref({
  botName: '',
  description: '',
  modelType: '',
  apiKey: '',
  systemPrompt: '',
})

const resetForm = () => {
  form.value = {
    botName: '',
    description: '',
    modelType: '',
    apiKey: '',
    systemPrompt: '',
  }
  success.value = false
  error.value = null
}

const createBot = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const botData = {
      name: form.value.botName,
      description: form.value.description,
      config: JSON.stringify({
        model: form.value.modelType,
        apiKey: form.value.apiKey,
        systemPrompt: form.value.systemPrompt
      }),
      status: 'draft'
    }
    
    const response = await $fetch<{ success: boolean; data: Bot; message?: string }>('/api/prisma/bots', {
      method: 'POST',
      body: botData
    })
    
    if (response.success) {
      success.value = true
      resetForm()
    } else {
      error.value = response.message || 'Failed to create bot'
    }
  } catch (err: any) {
    console.error('Error creating bot:', err)
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-form {
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
