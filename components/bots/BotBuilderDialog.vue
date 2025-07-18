<template>
  <v-card 
    class="bot-builder-dialog"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="startDrag"
  >
    <v-card-title class="d-flex justify-space-between align-center cursor-move">
      Create New Bot
      <v-btn icon="mdi-close" variant="text" @click="$emit('close')" />
    </v-card-title>
    <v-card-text>
      <BotBuilderCard @created="onBotCreated" />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BotBuilderCard from './BotBuilderCard.vue'

const emit = defineEmits(['close', 'created'])

const position = ref({ x: 0, y: 0 })
let isDragging = false
let startX = 0
let startY = 0
let startPosX = 0
let startPosY = 0

function startDrag(e: MouseEvent) {
  // Only start drag if clicking the title bar
  if (!(e.target as HTMLElement).closest('.cursor-move')) return

  isDragging = true
  startX = e.clientX
  startY = e.clientY
  startPosX = position.value.x
  startPosY = position.value.y

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging) return

  const deltaX = e.clientX - startX
  const deltaY = e.clientY - startY

  position.value = {
    x: startPosX + deltaX,
    y: startPosY + deltaY
  }
}

function stopDrag() {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function onBotCreated() {
  emit('created')
}
</script>

<style scoped>
.bot-builder-dialog {
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  user-select: none;
}

.cursor-move {
  cursor: move;
}
</style>
