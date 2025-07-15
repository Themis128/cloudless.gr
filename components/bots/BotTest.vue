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
import { useRoute } from 'vue-router'
import { useBotTest } from '~/composables/useBotTest'

const props = defineProps<{ botId?: string }>()
const route = useRoute()
let botId = props.botId || route.params.id
if (Array.isArray(botId)) botId = botId[0]

const {
  input,
  messages,
  steps,
  progress,
  sendMessage,
  reset
} = useBotTest(botId)
</script>
