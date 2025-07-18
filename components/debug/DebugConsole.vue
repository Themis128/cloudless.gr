<template>
  <div class="debug-console">
    <div v-if="title" class="console-title">
      {{ title }}
    </div>
    <div class="console-output">
      <div v-for="(line, idx) in outputProp" :key="idx" class="console-line">
        {{ line }}
      </div>
    </div>
    <form class="console-input-form" @submit.prevent="onRunCommand">
      <input
        v-model="command"
        class="console-input"
        placeholder="Type a command..."
        autocomplete="off"
      >
      <button type="submit">
        Run
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps({
  output: {
    type: Array,
    default: () => ['Welcome to the Debug Console!'],
  },
  title: {
    type: String,
    default: '',
  },
})
const emit = defineEmits(['run'])
const command = ref('')
const outputProp = computed(() => props.output)

const onRunCommand = () => {
  if (command.value.trim()) {
    emit('run', command.value)
    command.value = ''
  }
}
</script>

<style scoped>
.debug-console {
  font-family: monospace;
  background: #181818;
  color: #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.console-title {
  font-weight: bold;
  font-size: 1.1em;
  margin-bottom: 8px;
}
.console-output {
  min-height: 180px;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 12px;
  background: #222;
  padding: 8px;
  border-radius: 4px;
}
.console-line {
  white-space: pre-wrap;
}
.console-input-form {
  display: flex;
  gap: 8px;
}
.console-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #222;
  color: #e0e0e0;
}
button[type='submit'] {
  background: #444;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 16px;
  cursor: pointer;
  transition: background 0.2s;
}
button[type='submit']:hover {
  background: #666;
}
</style>
