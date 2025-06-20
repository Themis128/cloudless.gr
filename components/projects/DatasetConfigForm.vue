<template>
  <v-card class="pa-4">
    <v-card-title>Dataset Configuration</v-card-title>
    <v-card-text>
      <v-form>
        <v-select
          v-model="localValue.source"
          :items="datasetSources"
          label="Dataset Source"
          required
        />
        <v-text-field
          v-model="localValue.target"
          label="Target Column"
          required
        />
        <v-combobox
          v-model="localValue.features"
          label="Feature Columns"
          multiple
          chips
          clearable
        />
        <v-switch
          v-model="localValue.preprocessing"
          label="Enable Preprocessing"
        />
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';

interface DatasetConfig {
  source: string;
  features: string[];
  target: string;
  preprocessing?: boolean;
}

const props = defineProps<{
  modelValue: DatasetConfig;
  datasetSources?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: DatasetConfig): void;
}>();

const localValue = ref<DatasetConfig>({ ...props.modelValue });
const datasetSources = props.datasetSources || ['Upload', 'S3', 'GCS', 'Azure Blob', 'Demo Dataset'];

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
