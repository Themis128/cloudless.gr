<template>
  <v-card>
    <v-card-title>Test Bot</v-card-title>
    <v-card-text>
      <v-alert type="info" class="mb-4">
        Interact with your bot below. Send a message and view its response.
      </v-alert>
      <v-list>
        <v-list-item v-for="msg in messages" :key="msg.id">
          <template v-if="msg.role === 'user'" #prepend>
            <v-icon icon="mdi-account" class="me-2" />
          </template>
          <template v-else #prepend>
            <v-icon icon="mdi-robot" color="primary" class="me-2" />
          </template>
          <v-list-item-title>
            <span v-if="msg.role === 'user'" class="font-weight-bold"
              >You:</span
            >
            <span v-else class="text-primary">Bot:</span>
            <span class="ml-2">{{ msg.text }}</span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
      <v-text-field
        v-model="input"
        label="Type your message..."
        append-inner-icon="mdi-send"
        :disabled="isLoading"
        @keyup.enter="sendMessage"
        @click:append-inner="sendMessage"
      />
      <div v-if="hasSteps" class="mt-6">
        <v-progress-linear
          :value="progress"
          color="primary"
          height="8"
          rounded
        />
        <v-list class="mt-2">
          <v-list-item v-for="(step, idx) in steps" :key="step.name">
            <v-list-item-title
              :class="[
                step.status === 'running'
                  ? 'text-primary font-weight-bold'
                  : step.status === 'complete'
                    ? 'text-success'
                    : 'text-grey',
              ]"
            >
              {{ idx + 1 }}. {{ step.name }}
              <span v-if="step.status === 'running'">(Running)</span>
              <span v-else-if="step.status === 'complete'">(Complete)</span>
              <span v-else>(Pending)</span>
            </v-list-item-title>
            <v-list-item-subtitle v-if="step.result" class="text-grey-darken-1">
              {{ step.result }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const props = defineProps<{ botId?: string }>()
const route = useRoute()
let botId = props.botId || route.params.id
if (Array.isArray(botId)) botId = botId[0]

// Use the new bot test composable
const {
  input,
  messages,
  steps,
  progress,
  isLoading,
  error,
  hasSteps,
  sendMessage,
  reset,
  clearMessages,
  clearSteps,
  clearError,
} = useBotTest(botId)
</script>

<style scoped>
.v-list-item {
  min-height: 44px;
}
</style>
