<template>
  <v-card class="pa-4">
    <v-card-title>Model Defaults</v-card-title>
    <v-card-text>
      <v-form>
        <v-select
          v-model="localValue.algorithm"
          :items="algorithms"
          label="Default Algorithm"
          required
        />
        <v-text-field
          v-model.number="localValue.epochs"
          label="Epochs"
          type="number"
          min="1"
        />
        <v-text-field
          v-model.number="localValue.learningRate"
          label="Learning Rate"
          type="number"
          step="0.0001"
        />
        <v-text-field
          v-model.number="localValue.batch_size"
          label="Batch Size"
          type="number"
          min="1"
        />
        <v-switch
          v-model="localValue.earlyStopping"
          label="Enable Early Stopping"
        />
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';

interface ModelDefaults {
  algorithm: string;
  epochs: number;
  learningRate: number;
  batch_size: number;
  earlyStopping?: boolean;
}

const props = defineProps<{
  modelValue: ModelDefaults;
  algorithms?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ModelDefaults): void;
}>();

const localValue = ref<ModelDefaults>({ ...props.modelValue });
const algorithms = props.algorithms || ['neural_network', 'random_forest', 'xgboost', 'svm', 'logistic_regression'];

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
