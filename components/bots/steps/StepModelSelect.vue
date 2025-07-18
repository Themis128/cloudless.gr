<template>
  <div>
    <v-alert type="info" class="mb-4">
      <span v-text="description" />
    </v-alert>
    <v-select
      :model-value="form.model"
      :items="models"
      label="Model"
      :error-messages="modelError"
      @update:model-value="updateModel"
      @blur="validateModel"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  form: any
  modelError: string[]
  validateModel: () => void
  description: string
}>()

const emit = defineEmits<{
  'update:form': [form: any]
}>()

const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3']

const updateModel = (value: string) => {
  emit('update:form', { ...props.form, model: value })
}
</script>
