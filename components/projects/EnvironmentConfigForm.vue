<template>
  <v-card class="pa-4">
    <v-card-title>Environment Settings</v-card-title>
    <v-card-text>
      <v-form>
        <v-select
          v-model="localValue.instanceType"
          :items="instanceTypes"
          label="Default Instance Type"
          required
        />
        <v-switch
          v-model="localValue.autoScaling"
          label="Enable Autoscaling"
        />
        <v-text-field
          v-if="localValue.autoScaling"
          v-model.number="localValue.minInstances"
          label="Min Instances"
          type="number"
          min="1"
        />
        <v-text-field
          v-if="localValue.autoScaling"
          v-model.number="localValue.maxInstances"
          label="Max Instances"
          type="number"
          min="1"
        />
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';

interface EnvironmentConfig {
  instanceType: string;
  autoScaling: boolean;
  minInstances?: number;
  maxInstances?: number;
}

const props = defineProps<{
  modelValue: EnvironmentConfig;
  instanceTypes?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: EnvironmentConfig): void;
}>();

const localValue = ref<EnvironmentConfig>({ ...props.modelValue });
const instanceTypes = props.instanceTypes || ['standard-2', 'standard-4', 'gpu-1', 'gpu-2'];

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
