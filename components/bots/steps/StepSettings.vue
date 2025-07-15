<template>
  <div>
    <v-alert type="info" class="mb-4" v-html="description" />
    <v-text-field v-model="form.memory" label="Memory Context">
      <template #append>
        <v-tooltip text="Context window for bot memory (optional)">
          <v-icon>mdi-help-circle</v-icon>
        </v-tooltip>
      </template>
    </v-text-field>
    <v-text-field v-model="form.tools" label="Tools (comma-separated)">
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
  form: any,
  description: string
}>()
</script>
