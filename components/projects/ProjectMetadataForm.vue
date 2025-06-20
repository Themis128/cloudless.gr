<template>
  <v-card class="pa-4">
    <v-card-title>Project Metadata</v-card-title>
    <v-card-text>
      <v-form>
        <v-text-field
          v-model="localValue.name"
          label="Project Name"
          required
          :rules="[v => !!v || 'Name is required']"
        />
        <v-textarea
          v-model="localValue.description"
          label="Description"
          rows="3"
        />
        <v-combobox
          v-model="localValue.tags"
          label="Tags"
          multiple
          chips
          clearable
          hint="Press enter to add a tag"
        />
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';

interface ProjectMetadata {
  name: string;
  description?: string;
  tags?: string[];
}

const props = defineProps<{
  modelValue: ProjectMetadata;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ProjectMetadata): void;
}>();

const localValue = ref<ProjectMetadata>({ ...props.modelValue });

watch(
  () => props.modelValue,
  (val) => {
    localValue.value = { ...val };
  }
);

watch(
  localValue,
  (val) => {
    emit('update:modelValue', { ...val });
  },
  { deep: true }
);
</script>
