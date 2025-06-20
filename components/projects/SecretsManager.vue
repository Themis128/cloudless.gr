<template>
  <v-card class="pa-4">
    <v-card-title>Secrets & Variables</v-card-title>
    <v-card-text>
      <v-form>
        <v-text-field
          v-for="(value, key) in localValue"
          :key="key"
          v-model="localValue[key]"
          :label="key"
          clearable
        />
        <v-text-field
          v-model="newKey"
          label="New Key"
          class="mt-2"
        />
        <v-text-field
          v-model="newValue"
          label="New Value"
          class="mt-2"
        />
        <v-btn color="primary" class="mt-2" @click="addSecret">Add</v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string>): void;
}>();

const localValue = ref<Record<string, string>>({ ...props.modelValue });
const newKey = ref('');
const newValue = ref('');

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

function addSecret() {
  if (newKey.value && newValue.value) {
    localValue.value[newKey.value] = newValue.value;
    newKey.value = '';
    newValue.value = '';
  }
}
</script>
