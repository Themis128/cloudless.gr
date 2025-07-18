<template>
  <div>
    <v-alert type="info" class="mb-4">
      <span v-text="description" />
    </v-alert>
    <v-text-field
      :model-value="form.memory"
      label="Memory Context"
      @update:model-value="updateMemory"
    >
      <template #append>
        <v-tooltip text="Context window for bot memory (optional)">
          <v-icon>mdi-help-circle</v-icon>
        </v-tooltip>
      </template>
    </v-text-field>
    <v-text-field
      :model-value="form.tools"
      label="Tools (comma-separated)"
      @update:model-value="updateTools"
    >
      <template #append>
        <v-tooltip text="Comma-separated tool names (optional)">
          <v-icon>mdi-help-circle</v-icon>
        </v-tooltip>
      </template>
    </v-text-field>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  form: any
  description: string
}>()

const emit = defineEmits<{
  'update:form': [form: any]
}>()

const updateMemory = (value: string) => {
  emit('update:form', { ...props.form, memory: value })
}

const updateTools = (value: string) => {
  emit('update:form', { ...props.form, tools: value })
}
</script>
