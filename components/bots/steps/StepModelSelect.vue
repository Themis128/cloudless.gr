<template>
  <div>
    <v-alert type="info" class="mb-4" v-html="description" />
    <v-select
      v-model="form.model"
      :items="models"
      label="Model"
      :error-messages="modelError"
      @blur="validateModel"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  form: any,
  modelError: string[],
  validateModel: () => void,
  description: string
}>()

const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3']
</script>
