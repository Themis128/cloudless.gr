<template>
  <div>
    <v-alert type="info" class="mb-4">
      <span v-text="description" />
    </v-alert>
    <v-text-field
      :model-value="form.name"
      label="Bot Name"
      :error-messages="nameError"
      @update:model-value="updateName"
      @blur="validateName"
    />
    <div class="d-flex align-center mb-2">
      <v-textarea
        :model-value="form.prompt"
        label="Prompt"
        auto-grow
        :error-messages="promptError"
        class="flex-grow-1"
        @update:model-value="updatePrompt"
        @blur="validatePrompt"
      />
      <v-tooltip location="top">
        <template #activator="{ props }">
          <v-btn icon v-bind="props" variant="text" class="ms-2">
            <v-icon>mdi-help-circle</v-icon>
          </v-btn>
        </template>
        <span>{{ promptHelp }}</span>
      </v-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePromptHelp } from '~/composables/usePromptHelp'

const props = defineProps<{
  form: any
  nameError: string[]
  promptError: string[]
  validateName: () => void
  validatePrompt: () => void
  description: string
}>()

const emit = defineEmits<{
  'update:form': [form: any]
}>()

const promptHelp = usePromptHelp()

const updateName = (value: string) => {
  emit('update:form', { ...props.form, name: value })
}

const updatePrompt = (value: string) => {
  emit('update:form', { ...props.form, prompt: value })
}
</script>
