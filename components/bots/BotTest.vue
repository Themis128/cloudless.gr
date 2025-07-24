<template>
  <v-card>
    <v-card-title>Test Bot</v-card-title>
    <v-card-text>
      <v-alert type="info" class="mb-4">
        Interact with your bot below. Send a message and view its response.
      </v-alert>
      <v-list>
        <v-list-item v-for="msg in botStore.testMessages" :key="msg.id">
          <template v-if="msg.role === 'user'" #prepend>
            <v-icon icon="mdi-account" class="me-2" />
          </template>
          <template v-else #prepend>
            <v-icon icon="mdi-robot" color="primary" class="me-2" />
          </template>
          <v-list-item-title>
            <span
              v-if="msg.role === 'user'"
              class="font-weight-bold"
            >You:</span>
            <span v-else class="text-primary">Bot:</span>
            <span class="ml-2">{{ msg.text }}</span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
      <v-text-field
        v-model="botStore.testInput"
        label="Type your message..."
        append-inner-icon="mdi-send"
        :disabled="botStore.loading"
        @keyup.enter="sendMessage"
        @click:append-inner="sendMessage"
      />
      <div v-if="botStore.testSteps.length" class="mt-6">
        <v-progress-linear
          :value="botStore.testProgress"
          color="primary"
          height="8"
          rounded
        />
        <v-list class="mt-2">
          <v-list-item v-for="(step, idx) in botStore.testSteps" :key="step.name">
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
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{ botId?: string }>()
const route = useRoute()
let botId = props.botId || route.params.id
if (Array.isArray(botId)) botId = botId[0]

const botStore = useBotStore()

const sendMessage = async () => {
  if (!botStore.testInput.trim()) return
  await botStore.sendTestMessage(parseInt(botId), botStore.testInput)
}
</script>

<style scoped>
.v-list-item {
  min-height: 44px;
}
</style>
