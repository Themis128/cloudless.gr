<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-content">
      <h2>Insert Code to File</h2>
      <label for="file">Choose target file:</label>
      <select v-model="selectedFile" id="file">
        <option v-for="file in files" :key="file" :value="file">{{ file }}</option>
      </select>
      <label for="position">Insert at:</label>
      <select v-model="position" id="position">
        <option value="top">Top of file</option>
        <option value="bottom">Bottom of file</option>
      </select>
      <div class="modal-actions">
        <button @click="insertCode">Insert</button>
        <button @click="$emit('close')">Cancel</button>
      </div>
      <div v-if="inserted" class="inserted-msg">
        Code inserted! <button @click="undoInsert">Undo</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps({
  show: Boolean,
  code: String,
  files: Array,
});
const emit = defineEmits(['close', 'insert', 'undo']);
const selectedFile = ref(props.files[0] || '');
const position = ref('bottom');
const inserted = ref(false);

watch(
  () => props.files,
  (newFiles) => {
    if (newFiles.length) selectedFile.value = newFiles[0];
  }
);

function insertCode() {
  emit('insert', { file: selectedFile.value, position: position.value });
  inserted.value = true;
}
function undoInsert() {
  emit('undo', { file: selectedFile.value, position: position.value });
  inserted.value = false;
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 1rem;
  padding: 2rem;
  min-width: 320px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
}
.modal-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}
.inserted-msg {
  margin-top: 1rem;
  color: #2563eb;
}
</style>
