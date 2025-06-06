<template>
  <v-form @submit.prevent="handleSubmit" v-model="isValid">
    <v-card>
      <v-card-title>{{ isEditing ? 'Edit Agent' : 'Create New Agent' }}</v-card-title>
      <v-card-text>
        <v-container>
          <v-row>            <v-col cols="12">
              <v-text-field
                v-model="form.name"
                label="Agent Name"
                required
                :rules="nameRules"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.description"
                label="Description"
                required
                :rules="descriptionRules"
              ></v-textarea>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.model"
                :items="availableModels"
                label="Base Model"
                required
                :rules="modelRules"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.memoryType"
                :items="memoryTypes"
                label="Memory Type"
                required
                :rules="memoryTypeRules"
              ></v-select>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.systemPrompt"
                label="System Prompt"
                required
                :rules="systemPromptRules"
              ></v-textarea>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          type="submit"
          :loading="loading"
          :disabled="!isValid"
        >
          {{ isEditing ? 'Update Agent' : 'Create Agent' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-form>
</template>

<script setup lang="ts">
import { ref, computed } from '#imports'
import type { Agent } from '~/types/agents'

const props = defineProps<{
  agent?: Agent
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', agent: Partial<Agent>): void
}>()

const isValid = ref(false)
const isEditing = computed(() => !!props.agent)

const form = ref<Partial<Agent>>({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  model: props.agent?.model || '',
  memoryType: props.agent?.memoryType || 'conversation',
  systemPrompt: props.agent?.systemPrompt || ''
})

const availableModels = [
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'gemini-pro'
]

const memoryTypes = [
  { title: 'Conversation', value: 'conversation' },
  { title: 'Summary', value: 'summary' },
  { title: 'Buffer', value: 'buffer' }
]

// Validation rules with proper typing
const nameRules = [(v: string) => !!v || 'Name is required']
const descriptionRules = [(v: string) => !!v || 'Description is required']
const modelRules = [(v: string) => !!v || 'Model is required']
const memoryTypeRules = [(v: string) => !!v || 'Memory type is required']
const systemPromptRules = [(v: string) => !!v || 'System prompt is required']

const handleSubmit = () => {
  emit('submit', form.value)
}
</script>
