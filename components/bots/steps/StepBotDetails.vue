<template>
  <div>
    <v-alert type="info" class="mb-4" v-html="description" />
  <v-text-field v-model="form.name" label="Bot Name" :error-messages="nameError" @blur="validateName" />
    <div class="d-flex align-center mb-2">
      <v-textarea
        v-model="form.prompt"
        label="Prompt"
        auto-grow
        :error-messages="promptError"
        @blur="validatePrompt"
        class="flex-grow-1"
      />
      <v-tooltip location="top">
        <template #activator="{ props }">
          <v-btn icon v-bind="props" variant="text" class="ms-2"><v-icon>mdi-help-circle</v-icon></v-btn>
        </template>
        <span>{{ promptHelp }}</span>
      </v-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePromptHelp } from '~/composables/usePromptHelp'

const props = defineProps<{
  form: any,
  nameError: string[],
  promptError: string[],
  validateName: () => void,
  validatePrompt: () => void,
  description: string
}>()

const promptHelp = usePromptHelp()
</script>
