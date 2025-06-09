<template>
  <v-dialog v-model="dialogModel" max-width="500px" persistent>
    <v-card>
      <v-card-title class="text-h5">Insert Code to File</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedFile"
          :items="availableFiles"
          label="Choose target file"
          variant="outlined"
          density="comfortable"
          :rules="[(v) => !!v || 'Please select a file']"
          return-object
        ></v-select>

        <v-select
          v-model="position"
          :items="positions"
          item-title="title"
          item-value="value"
          label="Insert at"
          variant="outlined"
          density="comfortable"
        ></v-select>

        <v-alert
          v-if="inserted"
          type="success"
          variant="tonal"
          class="mt-4"
          closable
          @click:close="inserted = false"
        >
          Code inserted!
          <template v-slot:append>
            <v-btn color="success" variant="text" size="small" @click="undoInsert">Undo</v-btn>
          </template>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="insertCode" :disabled="!selectedFile"
          >Insert</v-btn
        >
        <v-btn color="grey-darken-1" variant="text" @click="closeDialog">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps({
  show: Boolean,
  code: String,
  files: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'insert', 'undo', 'update:show']);
const selectedFile = ref('');
const position = ref('bottom');
const inserted = ref(false);

// Position options
const positions = [
  { title: 'Top of file', value: 'top' },
  { title: 'Bottom of file', value: 'bottom' },
];

// Create a computed property for available files
const availableFiles = computed(() => {
  return props.files || [];
});

// Create a computed property for the dialog model that syncs with props.show
const dialogModel = computed({
  get: () => props.show,
  set: (value) => {
    if (!value) closeDialog();
  },
});

// Initialize the selected file when available
watch(
  () => props.files,
  (newFiles) => {
    if (newFiles?.length) {
      selectedFile.value = newFiles[0];
    }
  },
  { immediate: true }
);

// Reset state when dialog is opened
watch(
  () => props.show,
  (visible) => {
    if (visible) {
      inserted.value = false;
      if (props.files?.length) {
        selectedFile.value = props.files[0];
      }
      position.value = 'bottom';
    }
  }
);

function closeDialog() {
  emit('close');
  emit('update:show', false);
}

function insertCode() {
  if (!selectedFile.value) return;

  emit('insert', {
    file: selectedFile.value,
    position: position.value,
    code: props.code,
  });
  inserted.value = true;
}

function undoInsert() {
  emit('undo', {
    file: selectedFile.value,
    position: position.value,
  });
  inserted.value = false;
}
</script>
