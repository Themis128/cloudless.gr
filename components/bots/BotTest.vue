<template>
  <v-card>
    <v-card-title>Test Bot</v-card-title>
    <v-card-text>
      <v-alert type="info" class="mb-4">
        Interact with your bot below. Send a message and view its response.
      </v-alert>
      <v-list>
        <v-list-item v-for="msg in messages" :key="msg.id">
          <v-list-item-content>
            <span v-if="msg.role === 'user'" class="font-weight-bold">You:</span>
            <span v-else class="text-primary">Bot:</span>
            <span>{{ msg.text }}</span>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-text-field v-model="input" label="Type your message..." @keyup.enter="sendMessage" />
      <v-btn color="primary" :disabled="!input" @click="sendMessage">Send</v-btn>
      <div v-if="steps.length" class="mt-6">
        <v-progress-linear :value="progress" color="primary" height="8" rounded />
        <v-list class="mt-2">
          <v-list-item v-for="(step, idx) in steps" :key="step.name">
            <v-list-item-content>
              <span :class="step.status === 'running' ? 'text-primary font-weight-bold' : step.status === 'complete' ? 'text-success' : 'text-grey'">
                {{ idx + 1 }}. {{ step.name }}
                <span v-if="step.status === 'running'">(Running)</span>
                <span v-else-if="step.status === 'complete'">(Complete)</span>
                <span v-else>(Pending)</span>
              </span>
              <div v-if="step.result" class="text-caption text-grey-darken-1">{{ step.result }}</div>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ botId?: string }>()
const route = useRoute()
const botId = props.botId || route.params.id

const input = ref('')
const messages = ref<{ id: number; role: string; text: string }[]>([])
const steps = ref<any[]>([])
const progress = ref(0)
let msgId = 1

async function sendMessage() {
  if (!input.value) return
  const userMsg = input.value
  messages.value.push({ id: msgId++, role: 'user', text: userMsg })
  input.value = ''
  steps.value = []
  progress.value = 0
  try {
    const res = await fetch(`/api/bots/${botId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg })
    })
    const data = await res.json()
    if (data.response) {
      messages.value.push({ id: msgId++, role: 'bot', text: data.response })
    } else {
      messages.value.push({ id: msgId++, role: 'bot', text: data.error || 'No response from bot.' })
    }
    if (Array.isArray(data.steps)) {
      steps.value = data.steps.map((s: any) => ({ ...s }))
      progress.value = 0
      // Simulate real-time updates for each step
      let current = 0
      function updateStep() {
        if (current > 0) {
          steps.value[current - 1].status = 'complete'
          steps.value[current - 1].result = `Step '${steps.value[current - 1].name}' completed.`
        }
        if (current < steps.value.length) {
          steps.value[current].status = 'running'
          steps.value[current].result = `Step '${steps.value[current].name}' started.`
          progress.value = ((current + 1) / steps.value.length) * 100
          current++
          setTimeout(updateStep, 1200)
        } else {
          progress.value = 100
        }
      }
      // Initialize all steps to pending except first
      steps.value.forEach((s: any, idx: number) => {
        s.status = idx === 0 ? 'running' : 'pending'
        s.result = idx === 0 ? `Step '${s.name}' started with input: ${userMsg}` : null
      })
      setTimeout(updateStep, 1200)
    }
  } catch (err) {
    messages.value.push({ id: msgId++, role: 'bot', text: 'Error contacting bot API.' })
  }
}

watch(() => props.botId, () => {
  messages.value = []
  msgId = 1
})
</script>
